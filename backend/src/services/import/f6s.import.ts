/**
 * F6S Startup Programs Importer
 * Source: https://www.f6s.com/programs
 *
 * F6S aggregates accelerators, grants, competitions, and internships for startup
 * founders and early-career professionals worldwide. Italy filter yields relevant
 * programs from the Italian startup ecosystem.
 *
 * STATUS: DISABLED — C0 compliance verification pending.
 *
 * C0 checklist (complete before setting ENABLED = true):
 *   1. Check https://www.f6s.com/robots.txt — verify /programs path is allowed
 *   2. Review ToS at https://www.f6s.com/terms — check for scraping/automated access clauses
 *   3. Update SOURCES.md with verified robots.txt + ToS status
 *   4. Set ENABLED = true below
 *
 * Implementation notes (for when enabled):
 *   - F6S uses client-side rendering; fetchWithRetry returns mostly empty shells.
 *   - The preferred approach is their undocumented JSON API:
 *       GET https://www.f6s.com/api/v1/programs?country_code=IT&per_page=50&page=N
 *   - If the JSON API is unavailable/blocked, fall back to headless browser scraping
 *     (same pattern as company-watchlist.import.ts → fetchWithHeadlessBrowser).
 *   - Rate limit: 1 request per 2 seconds; max 5 pages per run.
 *
 * When enabled, add to:
 *   - scheduler.ts: weekly Tuesday at 05:00 (after Arbeitnow/RemoteOK slots)
 *   - import.routes.ts: POST /api/import/f6s
 *   - SOURCES.md: move from DISABLED to ENABLED section
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, stripHtml, mapOpportunityType } from './utils';

const ENABLED = false; // set true after C0 verification — see checklist above

const API_BASE = 'https://www.f6s.com/api/v1';
const PAGE_DELAY_MS = 2000;
const MAX_PAGES = 5;

// ---------------------------------------------------------------------------
// API types (based on known F6S response shape)
// ---------------------------------------------------------------------------

interface F6SProgram {
  id: number;
  name: string;
  description?: string;
  short_description?: string;
  deadline?: string | null;
  url?: string;
  apply_url?: string;
  type?: string;         // 'accelerator' | 'grant' | 'competition' | 'internship' | 'job'
  tags?: string[];
  location?: string;
  country?: string;
  organization?: { name: string };
}

interface F6SResponse {
  data: F6SProgram[];
  meta?: { total: number; page: number; per_page: number };
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

export async function importF6sOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  if (!ENABLED) {
    logger.info('[F6S] Import DISABLED — pending C0 compliance verification (robots.txt + ToS). See SOURCES.md.');
    return { imported: 0, skipped: 0, source: 'f6s' };
  }

  logger.info('[F6S] Starting import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'f6s', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    let skipped = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${API_BASE}/programs?country_code=IT&per_page=50&page=${page}`;
      let programs: F6SProgram[] = [];

      try {
        const res = await fetchWithRetry(url, {
          timeoutMs: 15000,
          headers: { Accept: 'application/json' },
          logTag: '[F6S]',
        });

        if (res.status === 404 || res.status === 401) {
          logger.warn(`[F6S] API returned ${res.status} — JSON endpoint may require auth. Consider headless fallback.`);
          break;
        }
        if (!res.ok) break;

        const data = (await res.json()) as F6SResponse;
        programs = Array.isArray(data) ? data : (data.data ?? []);
        if (programs.length === 0) break;
      } catch (err) {
        logger.warn(`[F6S] Fetch error page ${page}: ${err}`);
        break;
      }

      for (const prog of programs) {
        if (!prog.name) { skipped++; continue; }

        const description = stripHtml(prog.description || prog.short_description || '').slice(0, 1000)
          || `Programma F6S: ${prog.name}.`;

        const opportunityUrl = prog.apply_url || prog.url || `https://www.f6s.com/programs/${prog.id}`;
        const location = prog.location || prog.country || 'Italia';
        const company = prog.organization?.name || null;

        const rawType = prog.type?.toLowerCase() ?? '';
        const type = mapOpportunityType(prog.name, rawType ? [rawType] : null);

        const deadline = prog.deadline ? (() => {
          const d = new Date(prog.deadline!);
          return isNaN(d.getTime()) ? null : d;
        })() : null;
        if (deadline && deadline < now) { skipped++; continue; }

        const sourceId = `f6s-${prog.id}`;

        const validated = validateOpportunity(
          {
            title: prog.name,
            description,
            company,
            url: opportunityUrl,
            location,
            isAbroad: false,
            isRemote: false,
            expiresAt: null,
            deadline,
          },
          'f6s',
        );
        if (!validated) { skipped++; continue; }

        records.push({
          id: sourceId,
          title: validated.title,
          description: validated.description,
          company,
          url: opportunityUrl,
          location,
          isAbroad: false,
          isRemote: false,
          type,
          tags: ['startup', 'f6s', 'ecosistema', ...(prog.tags ?? []).map(t => t.toLowerCase())],
          postedAt: now,
          deadline,
          source: 'F6S',
          sourceId,
          lastSyncedAt: now,
          country: 'IT',
        });
        seenIds.push(sourceId);
      }

      if (page < MAX_PAGES) await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    if (records.length > 0) {
      await batchUpsertOpportunities(records);
      await markStaleOpportunities('F6S', seenIds, { minSeenForStale: 1 });
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: records.length, finishedAt: new Date(), metadata: { skipped } },
    });

    logger.info(`[F6S] Done: imported=${records.length}, skipped=${skipped}`);
    return { imported: records.length, skipped, source: 'f6s' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[F6S] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
