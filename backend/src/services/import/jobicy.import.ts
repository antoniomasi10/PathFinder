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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://jobicy.com/api/v2/remote-jobs';

/** Max results per request (API max is 100) */
const RESULTS_PER_REQUEST = 50;

/** Search tags targeting student opportunities */
const SEARCH_TAGS = [
  'internship',
  'intern',
  'trainee',
  'graduate',
  'junior',
  'entry-level',
  'stage',
  'werkstudent',
];

/** Geo filters for European coverage */
const GEO_FILTERS = [
  'europe',
  'emea',
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

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function mapType(title: string, jobTypes: string[]): OpportunityType {
  if (jobTypes.some(jt => jt.toLowerCase() === 'internship')) return 'INTERNSHIP';
  const t = title.toLowerCase();
  if (t.includes('stage') || t.includes('tirocinio') || t.includes('praktikum')) return 'STAGE';
  if (t.includes('intern') || t.includes('traineeship')) return 'INTERNSHIP';
  if (t.includes('trainee') || t.includes('apprenti') || t.includes('werkstudent') || t.includes('alternance')) return 'STAGE';
  if (t.includes('graduate') || t.includes('fellow')) return 'FELLOWSHIP';
  return 'INTERNSHIP';
}

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
    let imported = 0;
    let skipped = 0;
    const seenIds = new Set<number>();

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

          const res = await fetch(url, {
            signal: AbortSignal.timeout(30000),
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'PathFinderBot/1.0',
            },
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

          for (const job of jobs) {
            // Deduplicate within run
            if (seenIds.has(job.id)) { skipped++; continue; }
            seenIds.add(job.id);

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

            await prisma.opportunity.upsert({
              where: { id: sid },
              update: {
                title: validated.title,
                description: validated.description,
                company: validated.company,
                url: validated.url,
                location: validated.location,
                isAbroad: validated.isAbroad,
                isRemote: validated.isRemote,
                type: mapType(job.jobTitle, jobTypes),
                tags: industries,
                source: 'Jobicy',
                sourceId: sid,
                lastSyncedAt: now,
              },
              create: {
                id: sid,
                title: validated.title,
                description: validated.description,
                company: validated.company,
                url: validated.url,
                location: validated.location,
                isAbroad: validated.isAbroad,
                isRemote: validated.isRemote,
                type: mapType(job.jobTitle, jobTypes),
                tags: industries,
                postedAt: job.pubDate ? new Date(job.pubDate) : now,
                source: 'Jobicy',
                sourceId: sid,
                lastSyncedAt: now,
              },
            });
            imported++;
          }

          // Respectful delay between requests
          await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
        } catch (err) {
          logger.warn(`[Jobicy] tag="${tag}" geo="${geo}" failed: ${err}`);
          continue;
        }
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped },
      },
    });

    logger.info(`[Jobicy] Imported ${imported}, skipped ${skipped}`);
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
