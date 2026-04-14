/**
 * FashionUnited Job Import
 * Source: https://fashionunited.com/
 *
 * The largest fashion-industry job board — covers luxury, fast-fashion,
 * sportswear, beauty, and retail brands: Prada, Burberry, Ralph Lauren,
 * Nike, Chanel, Hugo Boss, Zara, Dior, Armani, etc.
 *
 * Auth: none — public GraphQL API (same data the website renders).
 * Legal: public API endpoint, no ToS restrictions on read access.
 *
 * Runs weekly Friday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPHQL_URL = 'https://api.fashionunited.com/graphql/';

/** Search keywords targeting student/intern roles */
const KEYWORDS = [
  'internship',
  'stage',
  'trainee',
  'Praktikum',
  'tirocinio',
  'alternance',
];

/** Jobs per page (API max is unclear — 50 is safe) */
const PAGE_SIZE = 50;

/** Max pages per keyword */
const MAX_PAGES = 20;

/** Delay between API calls (ms) */
const REQUEST_DELAY_MS = 800;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|strong|em|span)[^>]*>/gi, '\n')
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

function mapType(title: string, keyword: string): OpportunityType {
  const t = title.toLowerCase();
  const k = keyword.toLowerCase();
  if (k === 'stage' || t.includes('stage') || t.includes('tirocinio')) return 'STAGE';
  if (k === 'praktikum' || t.includes('praktikum')) return 'STAGE';
  if (k === 'alternance' || t.includes('alternance')) return 'STAGE';
  if (k === 'trainee' || t.includes('trainee')) return 'INTERNSHIP';
  if (t.includes('fellow') || t.includes('graduate')) return 'FELLOWSHIP';
  return 'INTERNSHIP';
}

function isCountryAbroad(country: string): boolean {
  return country.toLowerCase() !== 'italy';
}

// ---------------------------------------------------------------------------
// GraphQL query
// ---------------------------------------------------------------------------

const JOBS_QUERY = `
  query FashionJobs($keyword: String!, $limit: Int!, $offset: Int!) {
    jobs(keywords: $keyword, limit: $limit, offset: $offset) {
      id
      title
      teaser
      city
      country
      applyUrl
      publishedAt
      expiresAt
      company {
        name
      }
    }
    jobsCount(keywords: $keyword)
  }
`;

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface FUJob {
  id: number;
  title: string;
  teaser: string | null;
  city: string;
  country: string;
  applyUrl: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  company: { name: string };
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importFashionUnitedOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[FashionUnited] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'fashionunited', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    const seenIds = new Set<number>();

    for (const keyword of KEYWORDS) {
      for (let page = 0; page < MAX_PAGES; page++) {
        try {
          const offset = page * PAGE_SIZE;

          logger.info(`[FashionUnited] "${keyword}" offset ${offset}...`);

          const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            signal: AbortSignal.timeout(15000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: JOBS_QUERY,
              variables: { keyword, limit: PAGE_SIZE, offset },
            }),
          });

          if (!res.ok) {
            logger.warn(`[FashionUnited] "${keyword}" offset ${offset} returned ${res.status}`);
            break;
          }

          const body = await res.json() as {
            data?: { jobs: FUJob[]; jobsCount: number };
            errors?: any[];
          };

          if (body.errors?.length) {
            logger.warn(`[FashionUnited] GraphQL error: ${JSON.stringify(body.errors[0])}`);
            break;
          }

          const jobs = body.data?.jobs || [];
          const totalCount = body.data?.jobsCount || 0;

          if (jobs.length === 0) break;

          for (const job of jobs) {
            if (seenIds.has(job.id)) { skipped++; continue; }
            seenIds.add(job.id);

            const description = stripHtml(job.teaser || '').slice(0, 10000)
              || `${job.title} at ${job.company.name}`;
            const location = [job.city, job.country].filter(Boolean).join(', ');
            const isRemote = job.title.toLowerCase().includes('remote')
              || job.title.toLowerCase().includes('hybrid');
            const sid = `fashionunited-${job.id}`;

            const validated = validateOpportunity({
              title: `${job.title} — ${job.company.name}`,
              description,
              company: job.company.name || '',
              url: job.applyUrl || null,
              location,
              isAbroad: isCountryAbroad(job.country || ''),
              isRemote,
              expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
            }, 'fashionunited');

            if (!validated) { skipped++; continue; }

            const tags = ['Fashion', keyword].slice(0, 5);

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
                type: mapType(job.title, keyword),
                tags,
                source: 'FashionUnited',
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
                type: mapType(job.title, keyword),
                tags,
                postedAt: job.publishedAt ? new Date(job.publishedAt) : now,
                expiresAt: validated.expiresAt,
                source: 'FashionUnited',
                sourceId: sid,
                lastSyncedAt: now,
              },
            });
            imported++;
          }

          // Stop if we've fetched all results
          if (offset + jobs.length >= totalCount) break;

          await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
        } catch (err) {
          logger.warn(`[FashionUnited] "${keyword}" page ${page} failed: ${err}`);
          break;
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

    logger.info(`[FashionUnited] Imported ${imported}, skipped ${skipped}`);
    return { imported, skipped, source: 'fashionunited' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[FashionUnited] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
