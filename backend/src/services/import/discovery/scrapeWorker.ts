/**
 * Scrape worker — drains the ScrapeJob queue for tier B/C companies.
 *
 * Per job:
 *   1. compliance re-check (cached 30d, reused from company-watchlist importer)
 *   2. fetch — tier B: plain HTTP; tier C: headless Chromium
 *   3. change-detection — hash the page text; if unchanged, skip the LLM (the
 *      main cost lever at 20k+ scale) and just bump lastSyncedAt
 *   4. LLM extract → build records → batchUpsert (dedup + AI organize) → markStale
 *   5. health: reset/raise consecutiveFailures, auto-disable chronic failures
 */
import { createHash, randomUUID } from 'crypto';
import { CompanyWatchlist, HarvestTarget } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { fetchWithRetry, stripHtml, runWithConcurrency } from '../utils';
import { batchUpsertOpportunities, markStaleOpportunities } from '../batch';
import {
  processCompanyCompliance,
  fetchWithHeadlessBrowser,
  extractOpportunitiesWithLLM,
  buildWatchlistRecords,
} from '../company-watchlist.import';
import { processTargetCompliance } from './harvest-compliance';
import { extractOpportunitiesFromPage, buildHarvestRecords } from './extraction';
import { alertImportFailure } from '../alerting';
import { claimNextJob, completeJob, failJob, AUTO_DISABLE_THRESHOLD, ClaimedJob } from './queue';
import { getSpendUsd } from '../../ai/usage-report';

const WORKER_CONCURRENCY = 5;
const MIN_DOMAIN_INTERVAL_MS = 3000; // politeness: min gap between hits to same host
const DEFAULT_JOB_LIMIT = 200;
const BUDGET_CHECK_INTERVAL = 20; // re-check spend every N processed jobs
const LLM_DAILY_BUDGET_USD = Number(process.env.LLM_DAILY_BUDGET_USD ?? 5);

/**
 * True when 24h LLM spend is at/over budget. A null estimate (unpriced model in
 * the mix) is treated as "over budget" — fail safe, since we can't confirm
 * we're under. A read failure returns false (don't stall the whole queue on a
 * DB hiccup unrelated to the budget itself).
 */
async function budgetExceeded(): Promise<boolean> {
  try {
    const spend = await getSpendUsd(24);
    return spend === null || spend >= LLM_DAILY_BUDGET_USD;
  } catch {
    return false;
  }
}

type ScrapeStatus = 'ok' | 'unchanged' | 'blocked';

// In-memory per-domain last-hit map for rate limiting within a worker run.
const lastHit = new Map<string, number>();

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

async function respectDomainRateLimit(url: string): Promise<void> {
  const host = hostOf(url);
  const now = Date.now();
  const last = lastHit.get(host) ?? 0;
  const wait = last + MIN_DOMAIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

function hashContent(html: string): string {
  return createHash('sha256').update(stripHtml(html)).digest('hex');
}

/** Fetch + extract + upsert one company, with change-detection. */
async function scrapeCompany(company: CompanyWatchlist, tier: string, now: Date): Promise<ScrapeStatus> {
  const allowed = await processCompanyCompliance(company, now);
  if (!allowed) {
    await prisma.companyWatchlist.update({ where: { id: company.id }, data: { lastScrapeStatus: 'blocked', lastSyncedAt: now } });
    return 'blocked';
  }

  await respectDomainRateLimit(company.careersUrl);
  const html = tier === 'C'
    ? await fetchWithHeadlessBrowser(company.careersUrl)
    : await (await fetchWithRetry(company.careersUrl, { timeoutMs: 20000, logTag: `[Scrape B] ${company.name}` })).text();

  if (!html) {
    await prisma.companyWatchlist.update({ where: { id: company.id }, data: { lastScrapeStatus: 'error', lastSyncedAt: now } });
    return 'unchanged';
  }

  // Change-detection: skip the LLM when the page text is identical to last run.
  const hash = hashContent(html);
  if (company.contentHash && company.contentHash === hash) {
    await prisma.companyWatchlist.update({
      where: { id: company.id },
      data: { lastScrapeStatus: 'unchanged', lastSyncedAt: now, contentHashAt: now },
    });
    logger.info(`[Scrape] ${company.name}: content unchanged — LLM skipped`);
    return 'unchanged';
  }

  const rawOpportunities = await extractOpportunitiesWithLLM(html, company);
  const { records } = buildWatchlistRecords(company, rawOpportunities, now);

  if (records.length > 0) {
    await batchUpsertOpportunities(records);
    await markStaleOpportunities('CompanyWatchlist', records.map(r => r.id), {
      scopeCompanies: [company.name],
      minSeenForStale: 1,
    });
  }

  await prisma.companyWatchlist.update({
    where: { id: company.id },
    data: { lastScrapeStatus: 'ok', lastSyncedAt: now, contentHash: hash, contentHashAt: now },
  });
  logger.info(`[Scrape] ${company.name} (tier ${tier}): ${rawOpportunities.length} found, ${records.length} valid`);
  return 'ok';
}

/** Fetch + extract + upsert one harvest target, with change-detection. Twin of scrapeCompany. */
async function scrapeHarvestTarget(target: HarvestTarget, tier: string, now: Date): Promise<ScrapeStatus> {
  const allowed = await processTargetCompliance(target, now);
  if (!allowed) {
    await prisma.harvestTarget.update({ where: { id: target.id }, data: { lastScrapeStatus: 'blocked', lastSyncedAt: now } });
    return 'blocked';
  }

  await respectDomainRateLimit(target.url);
  const html = tier === 'C'
    ? await fetchWithHeadlessBrowser(target.url)
    : await (await fetchWithRetry(target.url, { timeoutMs: 20000, logTag: `[Scrape B] ${target.name}` })).text();

  if (!html) {
    await prisma.harvestTarget.update({ where: { id: target.id }, data: { lastScrapeStatus: 'error', lastSyncedAt: now } });
    return 'unchanged';
  }

  const hash = hashContent(html);
  if (target.contentHash && target.contentHash === hash) {
    await prisma.harvestTarget.update({
      where: { id: target.id },
      data: { lastScrapeStatus: 'unchanged', lastSyncedAt: now, contentHashAt: now },
    });
    logger.info(`[Scrape] ${target.name}: content unchanged — LLM skipped`);
    return 'unchanged';
  }

  const rawOpportunities = await extractOpportunitiesFromPage(html, {
    sourceLabel: target.sourceLabel, organizer: target.name, url: target.url, categoryHint: target.categoryHint,
  });
  const { records } = buildHarvestRecords(target, rawOpportunities, now);

  if (records.length > 0) {
    await batchUpsertOpportunities(records);
    await markStaleOpportunities('HarvestTarget', records.map(r => r.id), {
      scopeOrganizers: [target.name],
      minSeenForStale: 1,
    });
  }

  await prisma.harvestTarget.update({
    where: { id: target.id },
    data: { lastScrapeStatus: 'ok', lastSyncedAt: now, contentHash: hash, contentHashAt: now },
  });
  logger.info(`[Scrape] ${target.name} (tier ${tier}): ${rawOpportunities.length} found, ${records.length} valid`);
  return 'ok';
}

async function processJob(job: ClaimedJob): Promise<ScrapeStatus | 'error'> {
  const now = new Date();

  if (job.harvestTargetId) {
    const target = await prisma.harvestTarget.findUnique({ where: { id: job.harvestTargetId } });
    if (!target) {
      await completeJob(job.id); // orphaned job — nothing to do
      return 'error';
    }
    try {
      const status = await scrapeHarvestTarget(target, job.tier, now);
      await completeJob(job.id);
      if (target.consecutiveFailures > 0) {
        await prisma.harvestTarget.update({ where: { id: target.id }, data: { consecutiveFailures: 0 } });
      }
      return status;
    } catch (err: any) {
      const { exhausted } = await failJob(job, String(err));
      if (exhausted) {
        const failures = target.consecutiveFailures + 1;
        const disable = failures >= AUTO_DISABLE_THRESHOLD;
        await prisma.harvestTarget.update({
          where: { id: target.id },
          data: { consecutiveFailures: failures, lastScrapeStatus: 'error', ...(disable ? { isActive: false } : {}) },
        });
        if (disable) {
          logger.warn(`[Scrape] ${target.name}: auto-disabled after ${failures} consecutive failures`);
          alertImportFailure('harvest-target', 'opportunities', `Auto-disabled ${target.name}: ${err}`).catch(() => {});
        }
      }
      logger.warn(`[Scrape] ${target.name} job failed: ${err}`);
      return 'error';
    }
  }

  const company = await prisma.companyWatchlist.findUnique({ where: { id: job.companyId! } });
  if (!company) {
    await completeJob(job.id); // orphaned job — nothing to do
    return 'error';
  }
  try {
    const status = await scrapeCompany(company, job.tier, now);
    await completeJob(job.id);
    // Reset failure streak on any successful contact.
    if (company.consecutiveFailures > 0) {
      await prisma.companyWatchlist.update({ where: { id: company.id }, data: { consecutiveFailures: 0 } });
    }
    return status;
  } catch (err: any) {
    const { exhausted } = await failJob(job, String(err));
    if (exhausted) {
      const failures = company.consecutiveFailures + 1;
      const disable = failures >= AUTO_DISABLE_THRESHOLD;
      await prisma.companyWatchlist.update({
        where: { id: company.id },
        data: { consecutiveFailures: failures, lastScrapeStatus: 'error', ...(disable ? { isActive: false } : {}) },
      });
      if (disable) {
        logger.warn(`[Scrape] ${company.name}: auto-disabled after ${failures} consecutive failures`);
        alertImportFailure('company-watchlist', 'opportunities', `Auto-disabled ${company.name}: ${err}`).catch(() => {});
      }
    }
    logger.warn(`[Scrape] ${company.name} job failed: ${err}`);
    return 'error';
  }
}

/**
 * Drain up to `limit` jobs, `WORKER_CONCURRENCY` at a time. Safe to run
 * repeatedly (idle when the queue is empty).
 */
export async function runScrapeWorker(options?: { limit?: number }): Promise<{
  processed: number; ok: number; unchanged: number; blocked: number; failed: number; budgetStopped: boolean;
}> {
  const workerId = `worker-${randomUUID().slice(0, 8)}`;
  const limit = options?.limit ?? DEFAULT_JOB_LIMIT;
  const counts = { processed: 0, ok: 0, unchanged: 0, blocked: 0, failed: 0, budgetStopped: false };

  if (await budgetExceeded()) {
    logger.warn(`[ScrapeWorker] LLM daily budget ($${LLM_DAILY_BUDGET_USD}) already exceeded — skipping this run entirely`);
    alertImportFailure('scrape-queue', 'opportunities', `LLM daily budget exceeded before run start`).catch(() => {});
    counts.budgetStopped = true;
    return counts;
  }

  let batchesSinceBudgetCheck = 0;
  const batchesPerBudgetCheck = Math.max(1, Math.round(BUDGET_CHECK_INTERVAL / WORKER_CONCURRENCY));

  while (counts.processed < limit) {
    // Claim a batch up to the concurrency width.
    const batch: ClaimedJob[] = [];
    for (let i = 0; i < WORKER_CONCURRENCY && counts.processed + batch.length < limit; i++) {
      const job = await claimNextJob(workerId);
      if (!job) break;
      batch.push(job);
    }
    if (batch.length === 0) break; // queue drained

    await runWithConcurrency(batch, WORKER_CONCURRENCY, async (job) => {
      const status = await processJob(job);
      counts.processed++;
      if (status === 'ok') counts.ok++;
      else if (status === 'unchanged') counts.unchanged++;
      else if (status === 'blocked') counts.blocked++;
      else counts.failed++;
    });

    // Re-check the budget between batches (not mid-batch — claimed jobs always
    // finish once claimed). Jobs not yet claimed stay 'pending' and are picked
    // up by the next drain once the 24h window rolls forward.
    batchesSinceBudgetCheck++;
    if (batchesSinceBudgetCheck >= batchesPerBudgetCheck) {
      batchesSinceBudgetCheck = 0;
      if (await budgetExceeded()) {
        logger.warn(`[ScrapeWorker] ${workerId}: LLM daily budget ($${LLM_DAILY_BUDGET_USD}) reached after ${counts.processed} jobs — stopping drain`);
        alertImportFailure('scrape-queue', 'opportunities', `LLM daily budget exceeded mid-run after ${counts.processed} jobs`).catch(() => {});
        counts.budgetStopped = true;
        break;
      }
    }
  }

  logger.info(`[ScrapeWorker] ${workerId} done: ${JSON.stringify(counts)}`);
  return counts;
}
