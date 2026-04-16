/**
 * Lever ATS — Public Postings API Import
 * Source: https://github.com/lever/postings-api
 *
 * Lever is an ATS used by many tech companies. Their Postings API is public
 * (no auth for GET). We query multiple company boards and filter for
 * intern/stage/trainee/graduate roles relevant to university students.
 *
 * API: GET https://api.lever.co/v0/postings/{site}?limit=500
 *
 * Runs weekly on Friday at 03:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.lever.co/v0/postings';
const FETCH_DELAY_MS = 500;

/** Regex that matches student/intern role titles (word boundary to avoid "internal") */
const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|trainee|graduate.program|apprenti(?:ce)?|werkstudent|alternance|co-op|tirocinio)\b/i;

/**
 * Company boards to scrape. Curated for companies that offer or have recently
 * offered internships. Even if a board currently has 0 interns, they may
 * open positions seasonally (summer/fall cycles).
 * board_token → display name
 */
const BOARDS: Record<string, string> = {
  // Large tech — seasonal internship cycles
  'spotify': 'Spotify',
  'anchorage': 'Anchorage Digital',
  'dnb': 'Dun & Bradstreet',
  // Companies with active internships
  'shieldai': 'Shield AI',
  'weride': 'WeRide',
  'BestEgg': 'Best Egg',
  'rigetti': 'Rigetti Computing',
  'voleon': 'The Voleon Group',
  'theathletic': 'The Athletic',
  'aisafety': 'Center for AI Safety',
  'fehrandpeers': 'Fehr & Peers',
  'quincyinst': 'Quincy Institute',
  'solopulseco': 'SoloPulse',
  // Big enterprise — high brand recognition
  'palantir': 'Palantir',
  'bumbleinc': 'Bumble',
  'plaid': 'Plaid',
  'kraken': 'Kraken',
  // European companies
  'blablacar': 'BlaBlaCar',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  if (t.includes('intern')) return 'INTERNSHIP';
  if (t.includes('stage') || t.includes('stagiaire') || t.includes('trainee')) return 'STAGE';
  if (t.includes('graduate')) return 'FELLOWSHIP';
  if (t.includes('apprenti') || t.includes('alternance') || t.includes('werkstudent') || t.includes('co-op')) return 'STAGE';
  return 'INTERNSHIP';
}

function extractCountryCode(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('italy') || loc.includes('milan') || loc.includes('rome') || loc.includes('roma')) return 'IT';
  if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('san francisco') || loc.includes('los angeles') || loc.includes('seattle')) return 'US';
  if (loc.includes('united kingdom') || loc.includes('london') || loc.includes('uk')) return 'GB';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich')) return 'DE';
  if (loc.includes('france') || loc.includes('paris')) return 'FR';
  if (loc.includes('netherlands') || loc.includes('amsterdam')) return 'NL';
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
  if (loc.includes('sweden') || loc.includes('stockholm')) return 'SE';
  if (loc.includes('norway') || loc.includes('oslo')) return 'NO';
  if (loc.includes('remote')) return '';
  return '';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface LeverPosting {
  id: string;
  text: string;                       // job title
  descriptionPlain?: string;
  description?: string;
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
  };
  lists?: { text: string; content: string }[];
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;                 // epoch ms
  workplaceType?: string;
  country?: string;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importLeverOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Lever] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'lever', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let boardsProcessed = 0;

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}?limit=500`;
        logger.info(`[Lever] Fetching ${companyName} (${token})...`);

        const res = await fetch(url, {
          signal: AbortSignal.timeout(30000),
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          logger.warn(`[Lever] ${companyName} returned ${res.status}`);
          continue;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          logger.warn(`[Lever] ${companyName}: unexpected response`);
          continue;
        }

        // Filter for student/intern roles
        const studentJobs = data.filter((j: LeverPosting) => STUDENT_RE.test(j.text));

        for (const job of studentJobs as LeverPosting[]) {
          const sid = `lever-${token}-${job.id.slice(0, 20)}`;
          const location = job.categories?.location || '';
          const countryCode = job.country || extractCountryCode(location);
          const isAbroad = countryCode !== 'IT';
          const isRemote = job.workplaceType === 'remote' || location.toLowerCase().includes('remote');

          // Build description from plain text + lists
          const descParts = [stripHtml(job.descriptionPlain || job.description || '')];
          if (job.lists) {
            for (const list of job.lists) {
              descParts.push(`\n${list.text}:\n${stripHtml(list.content)}`);
            }
          }
          const description = descParts.join('\n').slice(0, 10000) || `${job.text} at ${companyName}`;

          // Tags from categories
          const tags = [
            job.categories?.department,
            job.categories?.team,
            job.categories?.commitment,
          ].filter(Boolean).slice(0, 5) as string[];

          const validated = validateOpportunity({
            title: `${job.text} — ${companyName}`,
            description,
            company: companyName,
            url: job.hostedUrl || job.applyUrl || null,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
          }, 'lever');

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
              type: mapType(job.text),
              tags,
              source: 'Lever',
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
              type: mapType(job.text),
              tags,
              postedAt: job.createdAt ? new Date(job.createdAt) : now,
              source: 'Lever',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        boardsProcessed++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Lever] ${companyName} failed: ${err}`);
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

    logger.info(`[Lever] Imported ${imported}, skipped ${skipped} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'lever' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Lever] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
