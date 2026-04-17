/**
 * Jobicy Remote Jobs Import
 * Source: https://jobicy.com/api/v2/remote-jobs
 *
 * Free public API, no key required. Remote-first job listings worldwide.
 * Legal: public API designed for "building job apps". Attribution required
 * (link back to jobicy.com). Redistribution to external job platforms
 * (Jooble, Google Jobs, LinkedIn) prohibited — PathFinder is a university
 * student platform, not a job board, so this is compliant.
 *
 * Rate limit: max 1 request/hour recommended, few times/day sufficient.
 * Listings carry a 6-hour publication delay.
 *
 * Runs weekly Thursday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, mapOpportunityType, fetchWithRetry } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://jobicy.com/api/v2/remote-jobs';

/** Max results per request (API max is 100) */
const RESULTS_PER_REQUEST = 50;

/** Search tags targeting student opportunities.
 *  Kept to 4 tags: `intern`, `trainee`, `graduate`, `junior` cover the pool
 *  returned by the redundant variants (`internship`, `entry-level`, `stage`,
 *  `werkstudent`) with full dedup via seenIds. */
const SEARCH_TAGS = [
  'intern',
  'trainee',
  'graduate',
  'junior',
];

/** Geo filters for European coverage — `emea` overlaps heavily with `europe`. */
const GEO_FILTERS = [
  'europe',
  'anywhere',
];

/** Delay between API requests (ms) — respect rate limits */
const REQUEST_DELAY_MS = 5000;

/** Student keywords for secondary filtering */
const STUDENT_KEYWORDS = [
  'intern', 'internship', 'stage', 'stagiaire', 'tirocinio',
  'trainee', 'traineeship', 'graduate', 'apprenti', 'apprentice',
  'student', 'werkstudent', 'alternance', 'junior', 'entry level',
  'entry-level', 'praktikum', 'co-op',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStudentRole(title: string, jobTypes: string[], jobLevel: string): boolean {
  const t = title.toLowerCase();
  if (t.includes('internal')) return false;
  // jobType includes "Internship" — strongest signal
  if (jobTypes.some(jt => jt.toLowerCase() === 'internship')) return true;
  // jobLevel check
  if (jobLevel.toLowerCase().includes('entry') || jobLevel.toLowerCase().includes('junior')) return true;
  // Keyword match in title
  return STUDENT_KEYWORDS.some(kw => t.includes(kw));
}

const mapType = (title: string, jobTypes: string[]): OpportunityType =>
  mapOpportunityType(title, jobTypes);

function extractCountryFromGeo(geo: string): string {
  const g = geo.toLowerCase();
  if (g.includes('italy') || g.includes('milan') || g.includes('rome') || g.includes('roma')) return 'IT';
  if (g.includes('germany') || g.includes('berlin') || g.includes('munich') || g.includes('münchen') || g.includes('hamburg') || g.includes('frankfurt')) return 'DE';
  if (g.includes('france') || g.includes('paris') || g.includes('lyon')) return 'FR';
  if (g.includes('spain') || g.includes('madrid') || g.includes('barcelona')) return 'ES';
  if (g.includes('netherlands') || g.includes('amsterdam') || g.includes('rotterdam')) return 'NL';
  if (g.includes('united kingdom') || g.includes('london') || g.includes('uk')) return 'GB';
  if (g.includes('ireland') || g.includes('dublin')) return 'IE';
  if (g.includes('austria') || g.includes('vienna') || g.includes('wien')) return 'AT';
  if (g.includes('belgium') || g.includes('brussels') || g.includes('bruxelles')) return 'BE';
  if (g.includes('switzerland') || g.includes('zurich') || g.includes('zürich')) return 'CH';
  if (g.includes('sweden') || g.includes('stockholm')) return 'SE';
  if (g.includes('poland') || g.includes('warsaw')) return 'PL';
  return 'EU';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface JobicyJob {
  id: number;
  url: string;
  jobSlug: string;
  jobTitle: string;
  companyName: string;
  companyLogo: string;
  jobIndustry: string[];
  jobType: string[];
  jobGeo: string;
  jobLevel: string;
  jobExcerpt: string;
  jobDescription: string;
  pubDate: string;
}

interface JobicyResponse {
  jobCount: number;
  jobs: JobicyJob[];
  success: boolean;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importJobicyOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[Jobicy] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'jobicy', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let requestsSucceeded = 0;
    const seenApiIds = new Set<number>();
    const records: OpportunityRecord[] = [];
    const seenSids: string[] = [];

    for (const tag of SEARCH_TAGS) {
      for (const geo of GEO_FILTERS) {
        try {
          const params = new URLSearchParams({
            count: String(RESULTS_PER_REQUEST),
            tag,
            geo,
          });

          const url = `${API_BASE}?${params.toString()}`;
          logger.info(`[Jobicy] Fetching tag="${tag}" geo="${geo}"...`);

          const res = await fetchWithRetry(url, {
            timeoutMs: 30000,
            headers: { 'Accept': 'application/json' },
            logTag: `[Jobicy] tag="${tag}" geo="${geo}"`,
          });

          if (!res.ok) {
            logger.warn(`[Jobicy] tag="${tag}" geo="${geo}" returned ${res.status}`);
            continue;
          }

          const body = await res.json() as JobicyResponse;
          const jobs = body.jobs || [];

          if (jobs.length === 0) {
            logger.info(`[Jobicy] No results for tag="${tag}" geo="${geo}"`);
            continue;
          }

          logger.info(`[Jobicy] Got ${jobs.length} results for tag="${tag}" geo="${geo}"`);

          requestsSucceeded++;
          for (const job of jobs) {
            // Deduplicate within run
            if (seenApiIds.has(job.id)) { skipped++; continue; }
            seenApiIds.add(job.id);

            // Filter: only student-relevant roles
            const jobTypes = job.jobType || [];
            if (!isStudentRole(job.jobTitle, jobTypes, job.jobLevel || '')) {
              skipped++;
              continue;
            }

            const description = stripHtml(job.jobDescription || job.jobExcerpt).slice(0, 10000)
              || `${job.jobTitle} at ${job.companyName}`;
            const location = job.jobGeo || 'Remote';
            const country = extractCountryFromGeo(location);
            const isAbroad = country !== 'IT';
            const industries = (job.jobIndustry || []).slice(0, 5);
            const sid = `jobicy-${job.id}`;

            const validated = validateOpportunity({
              title: `${job.jobTitle} — ${job.companyName}`,
              description,
              company: job.companyName || '',
              url: job.url || null,
              location,
              isAbroad,
              isRemote: true, // Jobicy is remote-only
              expiresAt: null,
            }, 'jobicy');

            if (!validated) { skipped++; continue; }

            seenSids.push(sid);
            records.push({
              id: sid,
              title: validated.title,
              description: validated.description,
              company: validated.company || null,
              url: validated.url ?? null,
              location: validated.location || null,
              isAbroad: validated.isAbroad,
              isRemote: validated.isRemote,
              type: mapType(job.jobTitle, jobTypes),
              tags: industries,
              postedAt: job.pubDate ? new Date(job.pubDate) : now,
              source: 'Jobicy',
              sourceId: sid,
              lastSyncedAt: now,
            });
          }

          // Respectful delay between requests
          await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
        } catch (err) {
          logger.warn(`[Jobicy] tag="${tag}" geo="${geo}" failed: ${err}`);
          continue;
        }
      }
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = requestsSucceeded >= 3
      ? await markStaleOpportunities('Jobicy', seenSids, { minSeenForStale: 10 })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, requestsSucceeded, staleCount },
      },
    });

    logger.info(`[Jobicy] Imported ${imported}, skipped ${skipped}, expired ${staleCount}`);
    return { imported, skipped, source: 'jobicy' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Jobicy] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
