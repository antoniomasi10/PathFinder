/**
 * Jooble Job Aggregator Import — Binario 3 (Fase 5 company-first scale-up).
 * Source: https://jooble.org/api/about — official API, free key on request.
 *
 * Legal: official documented API; ToS requires the returned `link` to be used
 * as-is (never resolved/rewritten) and attribution shown wherever a listing is
 * displayed (see the opportunity detail page's "Fonte" row).
 *
 * Skipped entirely (no error) when JOOBLE_API_KEY is unset — optional, keyed source.
 *
 * Runs weekly Thursday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, mapOpportunityType, isSeniorRole, extractCountryCode, fetchWithRetry } from './utils';

const API_BASE = 'https://jooble.org/api';
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 1500;
const KEYWORDS = 'tirocinio OR stage OR internship OR junior OR neolaureato OR apprendistato';

interface JoobleJob {
  id?: string | number;
  title: string;
  location: string;
  snippet: string;
  link: string;
  company?: string;
  updated?: string;
  type?: string;
}

interface JoobleResponse {
  totalCount: number;
  jobs: JoobleJob[];
}

export async function importJoobleOpportunities(): Promise<{ imported: number; skipped: number; source: string }> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    logger.info('[Jooble] JOOBLE_API_KEY not set — skipping (optional source)');
    return { imported: 0, skipped: 0, source: 'jooble-skipped' };
  }

  logger.info('[Jooble] Starting opportunity import...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: 'jooble', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    let pagesFetched = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      let body: JoobleResponse;
      try {
        const res = await fetchWithRetry(`${API_BASE}/${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: KEYWORDS, location: 'Italia', page: String(page) }),
          timeoutMs: 15000,
          logTag: `[Jooble] page ${page}`,
        });
        if (!res.ok) { logger.warn(`[Jooble] page ${page} returned ${res.status}`); break; }
        body = await res.json() as JoobleResponse;
      } catch (err) {
        logger.warn(`[Jooble] page ${page} failed: ${err}`);
        break;
      }

      const jobs = body.jobs || [];
      if (jobs.length === 0) { logger.info(`[Jooble] No more results at page ${page}`); break; }

      for (const job of jobs) {
        if (isSeniorRole(job.title)) { skipped++; continue; }
        if (!job.link) { skipped++; continue; }

        const company = job.company || '';
        const location = job.location || '';
        const country = extractCountryCode(location) || 'IT';
        const isAbroad = country !== 'IT';
        const description = stripHtml(job.snippet).slice(0, 10000) || `${job.title} at ${company}`;
        // Jooble doesn't expose a stable per-posting id in all regions — derive one from the link.
        const sid = `jooble-${job.id ?? Buffer.from(job.link).toString('base64url').slice(0, 40)}`;

        const validated = validateOpportunity({
          title: `${job.title} — ${company}`,
          description,
          company,
          url: job.link, // attribution requirement: link used as-is, never rewritten
          location,
          isAbroad,
          isRemote: location.toLowerCase().includes('remote'),
          expiresAt: null,
        }, 'jooble');

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
          type: mapOpportunityType(job.title, job.type ? [job.type] : []),
          tags: job.type ? [job.type] : [],
          postedAt: job.updated ? new Date(job.updated) : now,
          source: 'Jooble',
          sourceId: sid,
          lastSyncedAt: now,
        });
      }

      pagesFetched++;
      if (page * jobs.length >= (body.totalCount || 0)) { logger.info(`[Jooble] Reached last page (${page})`); break; }
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = pagesFetched >= 2
      ? await markStaleOpportunities('Jooble', seenIds, { minSeenForStale: 20 })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: imported, finishedAt: new Date(), metadata: { skipped, pagesFetched, staleCount } },
    });

    logger.info(`[Jooble] Imported ${imported}, skipped ${skipped}, expired ${staleCount}`);
    return { imported, skipped, source: 'jooble' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Jooble] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
