/**
 * Adzuna Job Aggregator Import — Binario 3 (Fase 5 company-first scale-up).
 * Source: https://developer.adzuna.com/ — official API, free tier, Italy endpoint.
 *
 * Legal: official documented API; ToS requires visible attribution/backlink to
 * Adzuna wherever a listing is shown (see the opportunity detail page's "Fonte"
 * row) and that the apply link (`redirect_url`) is used AS-IS, never resolved
 * or rewritten.
 *
 * Skipped entirely (no error) when ADZUNA_APP_ID/ADZUNA_APP_KEY are unset —
 * this is an optional, keyed source.
 *
 * Runs weekly Wednesday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, mapOpportunityType, isSeniorRole, fetchWithRetry } from './utils';

const API_BASE = 'https://api.adzuna.com/v1/api/jobs/it/search';

/** Max pages fetched per run (50 results/page free tier) — bounds run time + spend. */
const MAX_PAGES = 20;
const PAGE_DELAY_MS = 1500;
const MAX_DAYS_OLD = 45;

/** Student-facing role keywords; OR'd together in the `what_or` query param. */
const STUDENT_KEYWORDS = ['stage', 'tirocinio', 'internship', 'trainee', 'graduate', 'junior', 'neolaureato', 'apprendistato'];

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  company?: { display_name?: string };
  location?: { area?: string[]; display_name?: string };
  created?: string;
  category?: { label?: string };
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

export function isItalyLocation(area: string[] | undefined): boolean {
  return !!area?.some(a => a.toLowerCase() === 'italy' || a.toLowerCase() === 'italia');
}

export async function importAdzunaOpportunities(): Promise<{ imported: number; skipped: number; source: string }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    logger.info('[Adzuna] ADZUNA_APP_ID/ADZUNA_APP_KEY not set — skipping (optional source)');
    return { imported: 0, skipped: 0, source: 'adzuna-skipped' };
  }

  logger.info('[Adzuna] Starting opportunity import...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: 'adzuna', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    let pagesFetched = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: '50',
        what_or: STUDENT_KEYWORDS.join(' '),
        max_days_old: String(MAX_DAYS_OLD),
        sort_by: 'date',
      });
      const url = `${API_BASE}/${page}?${params.toString()}`;

      let body: AdzunaResponse;
      try {
        const res = await fetchWithRetry(url, { timeoutMs: 15000, headers: { Accept: 'application/json' }, logTag: `[Adzuna] page ${page}` });
        if (!res.ok) { logger.warn(`[Adzuna] page ${page} returned ${res.status}`); break; }
        body = await res.json() as AdzunaResponse;
      } catch (err) {
        logger.warn(`[Adzuna] page ${page} failed: ${err}`);
        break;
      }

      const jobs = body.results || [];
      if (jobs.length === 0) { logger.info(`[Adzuna] No more results at page ${page}`); break; }

      for (const job of jobs) {
        if (isSeniorRole(job.title)) { skipped++; continue; }

        const company = job.company?.display_name || '';
        const location = job.location?.display_name || '';
        const isAbroad = !isItalyLocation(job.location?.area);
        const description = stripHtml(job.description).slice(0, 10000) || `${job.title} at ${company}`;
        const sid = `adzuna-${job.id}`;

        const validated = validateOpportunity({
          title: `${job.title} — ${company}`,
          description,
          company,
          url: job.redirect_url || null, // attribution requirement: apply link used as-is, never rewritten
          location,
          isAbroad,
          isRemote: false,
          expiresAt: null,
        }, 'adzuna');

        if (!validated) { skipped++; continue; }

        seenIds.push(sid);
        records.push({
          id: sid,
          title: validated.title,
          description: validated.description,
          company: validated.company || null,
          url: validated.url ?? null,
          location: validated.location || null,
          isAbroad: validated.isAbroad,
          isRemote: validated.isRemote,
          type: mapOpportunityType(job.title, job.category?.label ? [job.category.label] : []),
          tags: job.category?.label ? [job.category.label] : [],
          postedAt: job.created ? new Date(job.created) : now,
          source: 'Adzuna',
          sourceId: sid,
          lastSyncedAt: now,
        });
      }

      pagesFetched++;
      if (page >= Math.ceil((body.count || 0) / 50)) { logger.info(`[Adzuna] Reached last page (${page})`); break; }
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = pagesFetched >= 2
      ? await markStaleOpportunities('Adzuna', seenIds, { minSeenForStale: 20 })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: imported, finishedAt: new Date(), metadata: { skipped, pagesFetched, staleCount } },
    });

    logger.info(`[Adzuna] Imported ${imported}, skipped ${skipped}, expired ${staleCount}`);
    return { imported, skipped, source: 'adzuna' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Adzuna] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
