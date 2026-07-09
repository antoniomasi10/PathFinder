/**
 * DB-backed scrape queue (tier B/C career-page scraping at scale).
 *
 * Tier A (ATS APIs) are batch-run per-platform by the ATS factory and are NOT
 * queued. This queue handles the long tail of custom/JS career sites that need
 * per-domain politeness, retries/backoff, and change-detection.
 *
 * No new infra: jobs live in the ScrapeJob table, claimed with Postgres
 * `FOR UPDATE SKIP LOCKED` so multiple workers/instances stay consistent.
 */
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';

export const REFRESH_INTERVAL_DAYS = 7;
export const AUTO_DISABLE_THRESHOLD = 5;
const DEFAULT_ENQUEUE_LIMIT = Number(process.env.SCRAPE_ENQUEUE_DAILY_LIMIT ?? 5000);

export interface ClaimedJob {
  id: string;
  companyId: string | null;
  harvestTargetId: string | null;
  tier: string;
  attempts: number;
  maxAttempts: number;
}

/**
 * Create pending jobs for tier B/C companies that are due for a refresh, are not
 * compliance-blocked, and are not already queued/running. Idempotent per run.
 */
export async function enqueueScrapeJobs(options?: { limit?: number; force?: boolean }): Promise<{ enqueued: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - REFRESH_INTERVAL_DAYS * 86400000);

  const companies = await prisma.companyWatchlist.findMany({
    where: {
      isActive: true,
      scrapeTier: { in: ['B', 'C'] },
      consecutiveFailures: { lt: AUTO_DISABLE_THRESHOLD },
      // allowed = null (unknown) or true; block only explicit false
      AND: [
        { OR: [{ robotsAllowed: null }, { robotsAllowed: true }] },
        { OR: [{ tosAllowed: null }, { tosAllowed: true }] },
      ],
      ...(options?.force ? {} : { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }] }),
    },
    select: { id: true, scrapeTier: true },
    take: options?.limit ?? DEFAULT_ENQUEUE_LIMIT,
  });

  // Batched anti-join instead of one findFirst per row — matters once the
  // company-registry funnel (Fase 5) is feeding tens of thousands of candidates.
  const alreadyQueuedCompanyIds = new Set(
    (await prisma.scrapeJob.findMany({
      where: { companyId: { in: companies.map(c => c.id) }, status: { in: ['pending', 'running'] } },
      select: { companyId: true },
    })).map(j => j.companyId),
  );

  let enqueued = 0;
  for (const c of companies) {
    if (alreadyQueuedCompanyIds.has(c.id)) continue;
    await prisma.scrapeJob.create({
      data: { companyId: c.id, tier: c.scrapeTier!, priority: c.scrapeTier === 'B' ? 10 : 5 },
    });
    enqueued++;
  }

  // HarvestTarget: only feedKind html-static/html-js go through the queue (they
  // need LLM extraction). jsonld/ics/rss targets are fetched directly in a
  // separate weekly batch (harvest-feed-runner.ts) — 0 LLM, no need for
  // per-domain backoff/rate-limit sophistication.
  const harvestTargets = await prisma.harvestTarget.findMany({
    where: {
      isActive: true,
      scrapeTier: { in: ['B', 'C'] },
      feedKind: { in: ['html-static', 'html-js'] },
      consecutiveFailures: { lt: AUTO_DISABLE_THRESHOLD },
      AND: [
        { OR: [{ robotsAllowed: null }, { robotsAllowed: true }] },
        { OR: [{ tosAllowed: null }, { tosAllowed: true }] },
      ],
      ...(options?.force ? {} : { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }] }),
    },
    select: { id: true, scrapeTier: true },
    take: options?.limit ?? DEFAULT_ENQUEUE_LIMIT,
  });

  const alreadyQueuedTargetIds = new Set(
    (await prisma.scrapeJob.findMany({
      where: { harvestTargetId: { in: harvestTargets.map(t => t.id) }, status: { in: ['pending', 'running'] } },
      select: { harvestTargetId: true },
    })).map(j => j.harvestTargetId),
  );

  for (const t of harvestTargets) {
    if (alreadyQueuedTargetIds.has(t.id)) continue;
    await prisma.scrapeJob.create({
      data: { harvestTargetId: t.id, tier: t.scrapeTier!, priority: t.scrapeTier === 'B' ? 10 : 5 },
    });
    enqueued++;
  }

  logger.info(`[ScrapeQueue] Enqueued ${enqueued} jobs (${companies.length + harvestTargets.length} due candidates)`);
  return { enqueued };
}

/**
 * Atomically claim the next runnable job. Uses FOR UPDATE SKIP LOCKED so
 * concurrent workers never grab the same row. Returns null when the queue is
 * drained. Exactly one of companyId/harvestTargetId is set on the returned job.
 */
export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "ScrapeJob" SET
      status = 'running',
      "lockedAt" = now(),
      "lockedBy" = ${workerId},
      attempts = attempts + 1,
      "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "ScrapeJob"
      WHERE status = 'pending' AND "runAfter" <= now()
      ORDER BY priority DESC, "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "companyId", "harvestTargetId", tier, attempts, "maxAttempts"
  `;
  return rows[0] ?? null;
}

/** Mark a claimed job done. */
export async function completeJob(jobId: string): Promise<void> {
  await prisma.scrapeJob.update({ where: { id: jobId }, data: { status: 'done', lockedAt: null, lockedBy: null } });
}

/**
 * Handle a failed attempt: reschedule with exponential backoff, or give up after
 * maxAttempts. Returns true when the job was permanently failed (exhausted).
 */
export async function failJob(job: ClaimedJob, error: string): Promise<{ exhausted: boolean }> {
  const exhausted = job.attempts >= job.maxAttempts;
  if (exhausted) {
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: error.slice(0, 500), lockedAt: null, lockedBy: null },
    });
    return { exhausted: true };
  }
  const backoffMs = Math.min(30 * 60000, 60000 * 2 ** job.attempts); // 2min,4min,… cap 30min
  await prisma.scrapeJob.update({
    where: { id: job.id },
    data: {
      status: 'pending',
      error: error.slice(0, 500),
      runAfter: new Date(Date.now() + backoffMs),
      lockedAt: null,
      lockedBy: null,
    },
  });
  return { exhausted: false };
}

/** Queue counts for the admin stats endpoint. */
export async function getQueueStats(): Promise<Record<string, number>> {
  const grouped = await prisma.scrapeJob.groupBy({ by: ['status'], _count: { _all: true } });
  const out: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const g of grouped) out[g.status] = g._count._all;
  return out;
}
