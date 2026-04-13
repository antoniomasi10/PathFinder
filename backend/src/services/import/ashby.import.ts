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
  // AI/ML companies
  'openai': 'OpenAI',
  'perplexity': 'Perplexity',
  'cohere': 'Cohere',
  'replit': 'Replit',
  // Fintech/SaaS
  'ramp': 'Ramp',
  'vanta': 'Vanta',
  'notion': 'Notion',
  // European companies
  'backmarket': 'Back Market',
  'alan': 'Alan',
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
  'mollie': 'Mollie',
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
  if (loc.includes('italy') || loc.includes('milan') || loc.includes('rome')) return 'IT';
  if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('san francisco') || loc.includes('los angeles') || loc.includes('seattle')) return 'US';
  if (loc.includes('united kingdom') || loc.includes('london')) return 'GB';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich')) return 'DE';
  if (loc.includes('france') || loc.includes('paris')) return 'FR';
  if (loc.includes('netherlands') || loc.includes('amsterdam')) return 'NL';
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
  if (loc.includes('canada') || loc.includes('toronto')) return 'CA';
  if (loc.includes('remote')) return '';
  return '';
}

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
  compensation?: {
    compensationTierSummary?: string;
  };
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
    let imported = 0;
    let skipped = 0;
    let boardsProcessed = 0;

    for (const [token, companyName] of Object.entries(boards)) {
      try {
        const url = `${API_BASE}/${token}?includeCompensation=true`;
        logger.info(`[Ashby] Fetching ${companyName} (${token})...`);

        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/json' },
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

          let description = stripHtml(job.descriptionPlain || job.descriptionHtml || '');
          if (job.compensation?.compensationTierSummary) {
            description += `\n\nCompensation: ${job.compensation.compensationTierSummary}`;
          }
          description = description.slice(0, 10000) || `${job.title} at ${companyName}`;

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
              source: 'Ashby',
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
              postedAt: job.publishedAt ? new Date(job.publishedAt) : now,
              source: 'Ashby',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        boardsProcessed++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Ashby] ${companyName} failed: ${err}`);
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

    logger.info(`[Ashby] Imported ${imported}, skipped ${skipped} from ${boardsProcessed} boards`);
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
