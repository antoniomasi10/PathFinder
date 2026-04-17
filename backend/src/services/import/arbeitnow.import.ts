/**
 * Arbeitnow Job Aggregator Import
 * Source: https://www.arbeitnow.com/api/job-board-api
 *
 * Free API, no key required, EU-focused job aggregator.
 * Legal: explicitly designed as a public job board API for aggregators.
 * Required: backlink attribution to arbeitnow.com.
 *
 * Runs weekly Tuesday at 03:30 via scheduler.ts.
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

const API_BASE = 'https://www.arbeitnow.com/api/job-board-api';

/** Max pages to fetch (100 jobs per page) */
const MAX_PAGES = 10;

/** Delay between page fetches (ms) — be respectful */
const PAGE_DELAY_MS = 2000;

/** Keywords to filter for student-relevant roles */
const STUDENT_KEYWORDS = [
  'intern', 'internship', 'stage', 'stagiaire', 'tirocinio',
  'trainee', 'traineeship', 'graduate', 'apprenti', 'apprentice',
  'student', 'werkstudent', 'alternance', 'junior', 'praktikum',
  'praktikant', 'volontariat', 'co-op',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStudentRole(title: string, jobTypes: string[]): boolean {
  const t = title.toLowerCase();
  if (t.includes('internal')) return false;
  // Check job_types first (most reliable signal)
  if (jobTypes.some(jt => jt.toLowerCase() === 'internship')) return true;
  return STUDENT_KEYWORDS.some(kw => t.includes(kw));
}

const mapType = (title: string, jobTypes: string[]): OpportunityType =>
  mapOpportunityType(title, jobTypes);

function extractCountryFromLocation(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('italy') || loc.includes('italia') || loc.includes('milan') || loc.includes('rome') || loc.includes('roma')) return 'IT';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich') || loc.includes('münchen') || loc.includes('hamburg') || loc.includes('frankfurt')) return 'DE';
  if (loc.includes('france') || loc.includes('paris') || loc.includes('lyon')) return 'FR';
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
  if (loc.includes('netherlands') || loc.includes('amsterdam') || loc.includes('rotterdam')) return 'NL';
  if (loc.includes('united kingdom') || loc.includes('london') || loc.includes('uk')) return 'GB';
  if (loc.includes('austria') || loc.includes('vienna') || loc.includes('wien')) return 'AT';
  if (loc.includes('belgium') || loc.includes('brussels') || loc.includes('bruxelles')) return 'BE';
  if (loc.includes('switzerland') || loc.includes('zurich') || loc.includes('zürich')) return 'CH';
  return 'EU';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links: { next: string | null };
  meta: { current_page: number; last_page: number };
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importArbeitnowOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[Arbeitnow] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'arbeitnow', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let pagesFetched = 0;
    const seenSlugs = new Set<string>();
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const url = `${API_BASE}?page=${page}`;
        logger.info(`[Arbeitnow] Fetching page ${page}...`);

        const res = await fetchWithRetry(url, {
          timeoutMs: 15000,
          headers: { 'Accept': 'application/json' },
          logTag: `[Arbeitnow] page ${page}`,
        });

        if (!res.ok) {
          logger.warn(`[Arbeitnow] Page ${page} returned ${res.status}`);
          break;
        }

        const body = await res.json() as ArbeitnowResponse;
        const jobs = body.data || [];

        if (jobs.length === 0) {
          logger.info(`[Arbeitnow] No more results at page ${page}`);
          break;
        }

        for (const job of jobs) {
          // Deduplicate within run
          if (seenSlugs.has(job.slug)) { skipped++; continue; }
          seenSlugs.add(job.slug);

          // Filter: only student-relevant roles
          if (!isStudentRole(job.title, job.job_types)) { skipped++; continue; }

          const description = stripHtml(job.description).slice(0, 10000)
            || `${job.title} at ${job.company_name}`;
          const location = job.location || '';
          const country = extractCountryFromLocation(location);
          const isAbroad = country !== 'IT';
          const isRemote = job.remote === true;
          const tags = (job.tags || []).slice(0, 5);
          const sid = `arbeitnow-${job.slug}`;

          const validated = validateOpportunity({
            title: `${job.title} — ${job.company_name}`,
            description,
            company: job.company_name || '',
            url: job.url || null,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'arbeitnow');

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
            type: mapType(job.title, job.job_types),
            tags,
            postedAt: job.created_at ? new Date(job.created_at * 1000) : now,
            source: 'Arbeitnow',
            sourceId: sid,
            lastSyncedAt: now,
          });
        }

        pagesFetched++;

        // Check if we've reached the last page
        if (page >= (body.meta?.last_page || MAX_PAGES)) {
          logger.info(`[Arbeitnow] Reached last page (${page})`);
          break;
        }

        // Respectful delay
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      } catch (err) {
        logger.warn(`[Arbeitnow] Page ${page} failed: ${err}`);
        break;
      }
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    // Only mark-stale if we successfully fetched a meaningful number of pages
    const staleCount = pagesFetched >= 3
      ? await markStaleOpportunities('Arbeitnow', seenIds, { minSeenForStale: 20 })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, pagesFetched, staleCount },
      },
    });

    logger.info(`[Arbeitnow] Imported ${imported}, skipped ${skipped}, expired ${staleCount}`);
    return { imported, skipped, source: 'arbeitnow' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Arbeitnow] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
