/**
 * Greenhouse ATS — Public Job Board API Import
 * Source: https://developers.greenhouse.io/job-board.html
 *
 * Greenhouse is an ATS used by many tech companies. Their Job Board API is
 * public (no auth needed for GET). We query multiple company boards and filter
 * for intern/stage/trainee/graduate roles relevant to university students.
 *
 * API: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 *
 * Runs weekly on Thursday at 03:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://boards-api.greenhouse.io/v1/boards';
const FETCH_DELAY_MS = 500;

/** Keywords that identify student/intern roles in job titles */
const STUDENT_KEYWORDS = [
  'intern', 'internship', 'stage', 'stagiaire', 'tirocinio',
  'trainee', 'traineeship', 'graduate', 'apprenti', 'apprentice',
  'student', 'co-op', 'werkstudent', 'alternance', 'junior',
];

/**
 * Company boards to scrape. Curated for companies that regularly offer
 * internships/stages relevant to university students.
 * board_token → display name
 */
const BOARDS: Record<string, string> = {
  // US tech — established internship programs
  'cloudflare': 'Cloudflare',
  'databricks': 'Databricks',
  'stripe': 'Stripe',
  'airbnb': 'Airbnb',
  'doordashusa': 'DoorDash',
  'anthropic': 'Anthropic',
  'scaleai': 'Scale AI',
  'coinbase': 'Coinbase',
  'asana': 'Asana',
  'okta': 'Okta',
  'datadog': 'Datadog',
  'imc': 'IMC Trading',
  'pinterest': 'Pinterest',
  'figma': 'Figma',
  'duolingo': 'Duolingo',
  'robinhood': 'Robinhood',
  'dropbox': 'Dropbox',
  'waymo': 'Waymo',
  'nuro': 'Nuro',
  'lyft': 'Lyft',
  'brex': 'Brex',
  'reddit': 'Reddit',
  'cockroachlabs': 'Cockroach Labs',
  'instacart': 'Instacart',
  // European companies
  'elastic': 'Elastic',
  'wolt': 'Wolt',
  'adyen': 'Adyen',
  'celonis': 'Celonis',
  'hellofresh': 'HelloFresh',
  'getyourguide': 'GetYourGuide',
  'doctolib': 'Doctolib',
  'contentful': 'Contentful',
  'trivago': 'Trivago',
  'monzo': 'Monzo',
  'sumup': 'SumUp',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStudentRole(title: string): boolean {
  const t = title.toLowerCase();
  // "internal" is not "intern" — skip roles like "Internal Audit", "Internal Communications"
  if (t.includes('internal')) return false;
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

function mapType(title: string): OpportunityType {
  const t = title.toLowerCase();
  if (t.includes('intern') || t.includes('tirocinio')) return 'INTERNSHIP';
  if (t.includes('stage') || t.includes('stagiaire')) return 'STAGE';
  if (t.includes('trainee')) return 'STAGE';
  if (t.includes('graduate')) return 'FELLOWSHIP';
  if (t.includes('apprenti') || t.includes('alternance') || t.includes('werkstudent')) return 'STAGE';
  return 'INTERNSHIP';
}

function extractCountryCode(location: string): string {
  const loc = location.toLowerCase();
  // Common patterns: "City, Country" or "City, State, Country"
  if (loc.includes('italy') || loc.includes('italia') || loc.includes('milan') || loc.includes('rome') || loc.includes('roma')) return 'IT';
  if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('san francisco') || loc.includes('seattle') || loc.includes('los angeles')) return 'US';
  if (loc.includes('united kingdom') || loc.includes('london') || loc.includes('uk')) return 'GB';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich') || loc.includes('münchen')) return 'DE';
  if (loc.includes('france') || loc.includes('paris')) return 'FR';
  if (loc.includes('netherlands') || loc.includes('amsterdam')) return 'NL';
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
  if (loc.includes('ireland') || loc.includes('dublin')) return 'IE';
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver')) return 'CA';
  if (loc.includes('singapore')) return 'SG';
  if (loc.includes('japan') || loc.includes('tokyo')) return 'JP';
  if (loc.includes('australia') || loc.includes('sydney')) return 'AU';
  if (loc.includes('remote')) return '';
  return '';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface GHJob {
  id: number;
  internal_job_id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location: { name: string };
  content?: string;
  departments: { name: string }[];
  offices: { name: string }[];
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importGreenhouseOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Greenhouse] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'greenhouse', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let boardsProcessed = 0;

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}/jobs?content=true`;
        logger.info(`[Greenhouse] Fetching ${companyName} (${token})...`);

        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          logger.warn(`[Greenhouse] ${companyName} returned ${res.status}`);
          continue;
        }

        const data = await res.json() as { jobs: GHJob[] };
        const jobs = data.jobs || [];

        // Filter for student/intern roles only
        const studentJobs = jobs.filter(j => isStudentRole(j.title));

        for (const job of studentJobs) {
          const sid = `greenhouse-${token}-${job.id}`;
          const location = job.location?.name || '';
          const countryCode = extractCountryCode(location);
          const isAbroad = countryCode !== 'IT';
          const isRemote = location.toLowerCase().includes('remote');

          const description = stripHtml(job.content || '') || `${job.title} at ${companyName}`;

          // Build tags from departments and offices
          const tags = [
            ...job.departments.map(d => d.name),
            ...job.offices.map(o => o.name),
          ].slice(0, 5);

          const validated = validateOpportunity({
            title: `${job.title} — ${companyName}`,
            description,
            company: companyName,
            url: job.absolute_url,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'greenhouse');

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
              source: 'Greenhouse',
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
              postedAt: job.updated_at ? new Date(job.updated_at) : now,
              source: 'Greenhouse',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        boardsProcessed++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Greenhouse] ${companyName} failed: ${err}`);
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

    logger.info(`[Greenhouse] Imported ${imported}, skipped ${skipped} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'greenhouse' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Greenhouse] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
