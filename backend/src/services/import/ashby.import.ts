/**
 * Ashby ATS — Public Job Board API Import
 * Source: https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 * Ashby is an ATS used by many tech/AI companies. Their Job Board API is
 * public (no auth for GET). We query multiple company boards and filter
 * for intern/stage/trainee/graduate roles relevant to university students.
 *
 * API: GET https://api.ashbyhq.com/posting-api/job-board/{clientname}
 *
 * Runs weekly on Friday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, extractCountryCode, mapOpportunityType, fetchWithRetry } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.ashbyhq.com/posting-api/job-board';
const FETCH_DELAY_MS = 500;

const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|trainee|graduate.program|apprenti(?:ce)?|werkstudent|alternance|co-op|tirocinio)\b/i;

/**
 * Company boards to scrape. Curated for companies that offer or have
 * recently offered internships/stages.
 */
const BOARDS: Record<string, string> = {
  // AI/ML companies — high brand recognition
  'openai': 'OpenAI',
  'perplexity': 'Perplexity',
  'cohere': 'Cohere',
  'replit': 'Replit',
  // Big enterprise — cloud/data
  'snowflake': 'Snowflake',
  // Fintech/SaaS
  'ramp': 'Ramp',
  'vanta': 'Vanta',
  'notion': 'Notion',
  // European companies
  'backmarket': 'Back Market',
  'alan': 'Alan',
  'mollie': 'Mollie',
  // Large tech with seasonal internships
  'linear': 'Linear',
  'supabase': 'Supabase',
  'cursor': 'Cursor',
  'posthog': 'PostHog',
  // High-growth SaaS with EU hiring
  'vercel': 'Vercel',
  'retool': 'Retool',
  'deel': 'Deel',
  'n8n': 'n8n',
  'elevenlabs': 'ElevenLabs',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mapType = mapOpportunityType;

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  secondaryLocations?: string[];
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importAshbyOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Ashby] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'ashby', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let boardsProcessed = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    const successfulCompanies: string[] = [];

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}`;
        logger.info(`[Ashby] Fetching ${companyName} (${token})...`);

        const res = await fetchWithRetry(url, {
          timeoutMs: 15000,
          headers: { 'Accept': 'application/json' },
          logTag: `[Ashby] ${companyName}`,
        });

        if (!res.ok) {
          logger.warn(`[Ashby] ${companyName} returned ${res.status}`);
          continue;
        }

        const data = await res.json() as { jobs: AshbyJob[] };
        const jobs = data.jobs || [];

        // Filter for student/intern roles
        const studentJobs = jobs.filter(j => STUDENT_RE.test(j.title));

        for (const job of studentJobs) {
          const sid = `ashby-${token}-${job.id.slice(0, 20)}`;
          const location = job.location || '';
          const countryCode = extractCountryCode(location);
          const isAbroad = countryCode !== 'IT';
          const isRemote = job.isRemote || job.workplaceType === 'Remote' || location.toLowerCase().includes('remote');

          const description = stripHtml(job.descriptionPlain || job.descriptionHtml || '')
            .slice(0, 10000) || `${job.title} at ${companyName}`;

          const tags = [job.department, job.team, job.employmentType].filter(Boolean).slice(0, 5) as string[];

          const validated = validateOpportunity({
            title: `${job.title} — ${companyName}`,
            description,
            company: companyName,
            url: job.jobUrl || job.applyUrl || null,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'ashby');

          if (!validated) { skipped++; continue; }

          seenIds.push(sid);
          records.push({
            id: sid,
            title: validated.title,
            description: validated.description,
            company: validated.company || companyName,
            url: validated.url ?? null,
            location: validated.location || null,
            isAbroad: validated.isAbroad,
            isRemote: validated.isRemote,
            type: mapType(job.title),
            tags,
            postedAt: job.publishedAt ? new Date(job.publishedAt) : now,
            source: 'Ashby',
            sourceId: sid,
            lastSyncedAt: now,
          });
        }

        boardsProcessed++;
        successfulCompanies.push(companyName);
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Ashby] ${companyName} failed: ${err}`);
      }
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = successfulCompanies.length > 0
      ? await markStaleOpportunities('Ashby', seenIds, { scopeCompanies: successfulCompanies })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, boardsProcessed, totalBoards: Object.keys(boards).length, staleCount },
      },
    });

    logger.info(`[Ashby] Imported ${imported}, skipped ${skipped}, expired ${staleCount} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'ashby' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Ashby] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
