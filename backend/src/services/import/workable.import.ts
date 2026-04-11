/**
 * Workable ATS — Public Widget API Import
 * Source: https://help.workable.com/hc/en-us/articles/115012771647
 *
 * Workable is an ATS used by many companies. Their Widget API is public
 * (no auth for GET). We query multiple company boards and filter for
 * intern/stage/trainee/graduate roles relevant to university students.
 *
 * API: GET https://apply.workable.com/api/v1/widget/accounts/{clientname}
 *
 * Note: The widget API returns metadata only (no job description).
 * We build a description from title + department + location + link.
 *
 * Runs weekly on Saturday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://apply.workable.com/api/v1/widget/accounts';
const FETCH_DELAY_MS = 500;

const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|trainee|graduate.program|apprenti(?:ce)?|werkstudent|alternance|co-op|tirocinio)\b/i;

/**
 * Company boards to scrape. Curated for companies that offer or have
 * recently offered internships/stages.
 */
const BOARDS: Record<string, string> = {
  'interactive-investor': 'Interactive Investor',
  'caxton': 'Caxton Associates',
  'coldquanta': 'Infleqtion',
  'f-dot-h-paschen-1': 'F.H. Paschen',
  'treatwell': 'Treatwell',
  'neon-rated': 'NEON Rated',
  'thorlabs': 'Thorlabs',
  'campusink': 'Campus Ink',
  'degy': 'Degy Booking International',
  'al-warren-oil-company-inc': 'Al Warren Oil Company',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapType(title: string): OpportunityType {
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'INTERNSHIP';
  if (t.includes('stage') || t.includes('stagiaire') || t.includes('trainee')) return 'STAGE';
  if (t.includes('graduate')) return 'FELLOWSHIP';
  if (t.includes('apprenti') || t.includes('alternance') || t.includes('werkstudent') || t.includes('co-op')) return 'STAGE';
  return 'INTERNSHIP';
}

function extractCountryCode(job: WorkableJob): string {
  // Workable provides countryCode directly in locations
  if (job.locations?.[0]?.countryCode) return job.locations[0].countryCode;
  const loc = (job.country || '').toLowerCase();
  if (loc.includes('italy')) return 'IT';
  if (loc.includes('united states')) return 'US';
  if (loc.includes('united kingdom')) return 'GB';
  if (loc.includes('germany')) return 'DE';
  if (loc.includes('france')) return 'FR';
  if (loc.includes('netherlands')) return 'NL';
  if (loc.includes('spain')) return 'ES';
  if (loc.includes('canada')) return 'CA';
  if (loc.includes('sweden')) return 'SE';
  return '';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface WorkableJob {
  title: string;
  shortcode: string;
  code?: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  shortlink?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  education?: string;
  experience?: string;
  function?: string;
  industry?: string;
  locations?: {
    country: string;
    countryCode: string;
    city: string;
    region: string;
    hidden: boolean;
  }[];
}

interface WorkableResponse {
  name: string;
  description?: string;
  jobs: WorkableJob[];
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importWorkableOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Workable] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'workable', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let boardsProcessed = 0;

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}`;
        logger.info(`[Workable] Fetching ${companyName} (${token})...`);

        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          logger.warn(`[Workable] ${companyName} returned ${res.status}`);
          continue;
        }

        const data = await res.json() as WorkableResponse;
        const jobs = data.jobs || [];

        // Filter for student/intern roles
        const studentJobs = jobs.filter(j => STUDENT_RE.test(j.title));

        for (const job of studentJobs) {
          const sid = `workable-${token}-${job.shortcode}`;
          const locationParts = [job.city, job.state, job.country].filter(Boolean);
          const location = locationParts.join(', ');
          const countryCode = extractCountryCode(job);
          const isAbroad = countryCode !== 'IT';
          const isRemote = job.telecommuting || false;

          // Build description from available metadata (widget API has no description)
          const descParts = [`${job.title} at ${companyName}`];
          if (job.department) descParts.push(`Department: ${job.department}`);
          if (location) descParts.push(`Location: ${location}`);
          if (job.employment_type) descParts.push(`Type: ${job.employment_type}`);
          if (job.industry) descParts.push(`Industry: ${job.industry}`);
          if (job.url) descParts.push(`Apply: ${job.url}`);
          const description = descParts.join('\n');

          const tags = [job.department, job.employment_type, job.industry].filter(Boolean).slice(0, 5) as string[];

          const validated = validateOpportunity({
            title: `${job.title} — ${companyName}`,
            description,
            company: companyName,
            url: job.url || job.application_url || null,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'workable');

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
              type: mapType(job.title),
              tags,
              source: 'Workable',
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
              type: mapType(job.title),
              tags,
              postedAt: job.published_on ? new Date(job.published_on) : now,
              source: 'Workable',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        boardsProcessed++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Workable] ${companyName} failed: ${err}`);
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, boardsProcessed, totalBoards: Object.keys(boards).length },
      },
    });

    logger.info(`[Workable] Imported ${imported}, skipped ${skipped} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'workable' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Workable] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
