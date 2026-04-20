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
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, extractCountryCode, mapOpportunityType, fetchWithRetry } from './utils';

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
  // Big enterprise — high brand recognition
  'twitch': 'Twitch',
  'discord': 'Discord',
  'epicgames': 'Epic Games',
  'riotgames': 'Riot Games',
  'roblox': 'Roblox',
  'unity3d': 'Unity',
  'twilio': 'Twilio',
  'zscaler': 'Zscaler',
  'toast': 'Toast',
  'udemy': 'Udemy',
  'verkada': 'Verkada',
  'coupang': 'Coupang',
  'squarespace': 'Squarespace',
  'intercom': 'Intercom',
  'gitlab': 'GitLab',
  'airtable': 'Airtable',
  'janestreet': 'Jane Street',
  // Finance / Trading
  'flowtraders': 'Flow Traders',
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
  'n26': 'N26',
  'toogoodtogo': 'Too Good To Go',
  'realtimeboardglobal': 'Miro',
  'parloa': 'Parloa',
  'gropyus': 'GROPYUS',
  'remotecom': 'Remote',
  'clara': 'Clara',
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

const mapType = mapOpportunityType;

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
    let skipped = 0;
    let boardsProcessed = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    const successfulCompanies: string[] = [];

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}/jobs?content=true`;
        logger.info(`[Greenhouse] Fetching ${companyName} (${token})...`);

        const res = await fetchWithRetry(url, {
          timeoutMs: 15000,
          headers: { 'Accept': 'application/json' },
          logTag: `[Greenhouse] ${companyName}`,
        });

        if (!res.ok) {
          logger.warn(`[Greenhouse] ${companyName} returned ${res.status}`);
          continue;
        }

        const data = await res.json() as { jobs: GHJob[] };
        const jobs = data.jobs || [];
        const studentJobs = jobs.filter(j => isStudentRole(j.title));

        for (const job of studentJobs) {
          const sid = `greenhouse-${token}-${job.id}`;
          const location = job.location?.name || '';
          const countryCode = extractCountryCode(location);
          const isAbroad = countryCode !== 'IT';
          const isRemote = location.toLowerCase().includes('remote');
          const description = stripHtml(job.content || '') || `${job.title} at ${companyName}`;
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
            postedAt: job.updated_at ? new Date(job.updated_at) : now,
            source: 'Greenhouse',
            sourceId: sid,
            lastSyncedAt: now,
          });
        }

        boardsProcessed++;
        successfulCompanies.push(companyName);
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Greenhouse] ${companyName} failed: ${err}`);
      }
    }

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = successfulCompanies.length > 0
      ? await markStaleOpportunities('Greenhouse', seenIds, { scopeCompanies: successfulCompanies })
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

    logger.info(`[Greenhouse] Imported ${imported}, skipped ${skipped}, expired ${staleCount} from ${boardsProcessed} boards`);
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
