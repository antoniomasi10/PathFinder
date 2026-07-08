/**
 * MSCA Fellowship Import
 * Source: EU Funding & Tenders Portal — SEDIA search API
 * (https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA)
 *
 * Official, public, unauthenticated search API — the same one the portal's own frontend
 * (ec.europa.eu/info/funding-tenders/opportunities/portal) uses. Scoped to Marie
 * Skłodowska-Curie Actions (MSCA) calls — the EU's individual-researcher mobility scheme
 * (Postdoctoral Fellowships, Doctoral Networks, COFUND, Staff Exchanges) — rather than the
 * portal's much larger catalogue of institutional-only grants (aimed at organizations/
 * companies/universities as applicants), which is out of scope for a student-facing
 * platform. EURAXESS, the originally-planned fellowship source, is EXCLUDED (robots.txt
 * blocks /jobs/* and /api/*+/rest/* — see SOURCES.md); this is its replacement.
 *
 * Request format was reverse-engineered from the portal's own public Angular bundle
 * (reading public JS served to any browser — not scraping gated content): the API silently
 * ignores a raw JSON body and instead requires multipart/form-data with a `query` part
 * (JSON blob) and a `languages` part (JSON blob). `type: ["1","2","8"]` restricts results
 * to calls/topics (excludes FAQ/news/events, which otherwise dominate relevance ranking).
 * `status` codes were decoded empirically against real records' deadlineDate/startDate:
 * 31094501 = forthcoming, 31094502 = open, 31094503 = closed.
 *
 * Legal basis: official EU Commission API, public apiKey ("SEDIA") used by the portal's own
 * frontend, no authentication required, no robots.txt/ToS restriction on ec.europa.eu for
 * this path. Verified 2026-07-08.
 *
 * Caveat: the server-side `status` filter is a heuristic, not ground truth — some indexed
 * records carry a stale forthcoming/open status despite a `deadlineDate` already in the
 * past. We defensively re-check `deadlineDate > now` ourselves before importing.
 *
 * Runs weekly ... via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, stripHtml } from './utils';

const SEARCH_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const API_KEY = 'SEDIA';
const SOURCE_KEY = 'msca';
const TEXT_QUERY = 'MSCA';
const PAGE_SIZE = 100;
const ORGANIZER = 'Marie Skłodowska-Curie Actions (European Commission)';

// Calls/topics only (excludes FAQ="3", news, events) — see module doc for how this was found.
const TYPE_FILTER = ['1', '2', '8'];
// Forthcoming + open only — closed calls ("31094503") are never worth importing.
const STATUS_FILTER = ['31094501', '31094502'];

interface SediaMetadata {
  [key: string]: string[] | undefined;
}

interface SediaResult {
  reference: string;
  url: string;
  summary: string;
  metadata: SediaMetadata;
}

interface SediaSearchResponse {
  totalResults: number;
  results: SediaResult[];
}

function metaFirst(md: SediaMetadata, key: string): string | null {
  const v = md[key];
  return v && v.length > 0 ? v[0] : null;
}

/** Multi-stage calls carry multiple deadlineDate entries — we want the final (latest) one. */
function metaLatestDate(md: SediaMetadata, key: string): Date | null {
  const values = md[key];
  if (!values || values.length === 0) return null;
  const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

function buildQueryForm(): FormData {
  const query = {
    bool: {
      must: [
        { terms: { type: TYPE_FILTER } },
        { terms: { status: STATUS_FILTER } },
      ],
    },
  };
  const form = new FormData();
  form.append('query', new Blob([JSON.stringify(query)], { type: 'application/json' }));
  form.append('languages', new Blob([JSON.stringify(['en'])], { type: 'application/json' }));
  form.append('displayLanguage', 'en');
  return form;
}

function buildSourceId(reference: string): string {
  return `msca-${reference}`;
}

export async function importMscaOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[MSCA] Starting fellowship import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const searchUrl = `${SEARCH_URL}?apiKey=${API_KEY}&text=${encodeURIComponent(TEXT_QUERY)}&pageSize=${PAGE_SIZE}&pageNumber=1`;
    const res = await fetchWithRetry(searchUrl, {
      method: 'POST',
      body: buildQueryForm(),
      timeoutMs: 20000,
      logTag: '[MSCA]',
    });
    if (!res.ok) throw new Error(`SEDIA search API failed: HTTP ${res.status}`);

    const data = await res.json() as SediaSearchResponse;
    const results = data.results ?? [];
    logger.info(`[MSCA] Found ${results.length} candidate calls/topics (total matched: ${data.totalResults})`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const r of results) {
      try {
        const md = r.metadata ?? {};
        const sid = buildSourceId(r.reference);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        // Defensive re-check: server-side status can be stale on older indexed records.
        const deadline = metaLatestDate(md, 'deadlineDate');
        if (!deadline || deadline.getTime() <= now.getTime()) { skipped++; continue; }

        const title = (metaFirst(md, 'title') || r.summary || '').slice(0, 250);
        if (!title) { skipped++; continue; }

        const descriptionHtml =
          metaFirst(md, 'destinationDetails') ||
          metaFirst(md, 'descriptionByte') ||
          metaFirst(md, 'destinationDescription') || '';
        const description = stripHtml(descriptionHtml).slice(0, 10000);
        if (description.length < 10) { skipped++; continue; }

        const startDate = metaLatestDate(md, 'startDate');
        const postedAt = startDate ?? now;
        const url = r.url || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${metaFirst(md, 'identifier') ?? ''}`;

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: ORGANIZER,
          url,
          location: null,
          isAbroad: true, // pan-European scheme, not Italy-specific — falls into the FELLOWSHIP isAbroad carve-out
          isRemote: false, // in-person research position at a host institution
          expiresAt: deadline,
          deadline,
          cost: 0,
          hasScholarship: true,
          eligibleFields: [],
        }, SOURCE_KEY);
        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: ORGANIZER,
          url,
          location: null,
          isAbroad: true,
          isRemote: false,
          type: 'FELLOWSHIP',
          tags: ['msca', 'fellowship', 'horizon-europe'],
          postedAt,
          expiresAt: deadline,
          deadline,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          cost: 0,
          hasScholarship: true,
          eligibleFields: [],
        });
      } catch (err) {
        logger.warn(`[MSCA] Error processing "${r.reference}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);
    await markStaleOpportunities(SOURCE_KEY, records.map(rec => rec.id), { minSeenForStale: 3 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: records.length, finishedAt: new Date(), metadata: { skipped, totalMatched: data.totalResults } },
    });
    logger.info(`[MSCA] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[MSCA] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}

// Exported for unit testing only.
export const __testables = { metaFirst, metaLatestDate, buildSourceId };
