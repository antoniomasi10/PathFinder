/**
 * The Muse Job Import
 * Source: https://www.themuse.com/developers/api/v2
 *
 * Free public API with Internship-level filter. Covers major enterprise
 * companies (Google, Amazon, Coca-Cola, JPMorgan, McKinsey, Deloitte, etc.)
 * across multiple industries — not limited to tech.
 *
 * Auth: api_key query param (3600 req/hr). Works without key (500 req/hr).
 * Legal: public API, designed for third-party integration.
 *
 * Runs weekly Wednesday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://www.themuse.com/api/public/jobs';

const MUSE_API_KEY = process.env.MUSE_API_KEY || '';

/** Max pages to fetch (20 jobs per page) */
const MAX_PAGES = 25;

/** Delay between API calls (ms) — stay well under 3600 req/hr */
const REQUEST_DELAY_MS = 1500;

/** EU locations to query (The Muse location filter values) */
const EU_LOCATIONS = [
  'Europe',
  'London, United Kingdom',
  'Berlin, Germany',
  'Paris, France',
  'Amsterdam, Netherlands',
  'Dublin, Ireland',
  'Milan, Italy',
  'Zurich, Switzerland',
  'Munich, Germany',
  'Madrid, Spain',
  'Barcelona, Spain',
  'Brussels, Belgium',
  'Stockholm, Sweden',
  'Vienna, Austria',
  'Warsaw, Poland',
];

/** Levels to filter */
const LEVELS = ['Internship', 'Entry Level'];

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

function mapType(levels: { name: string }[], title: string): OpportunityType {
  const hasInternship = levels.some(l => l.name === 'Internship');
  if (hasInternship) return 'INTERNSHIP';
  const t = title.toLowerCase();
  if (t.includes('stage') || t.includes('tirocinio') || t.includes('praktikum')) return 'STAGE';
  if (t.includes('trainee') || t.includes('apprenti') || t.includes('werkstudent')) return 'STAGE';
  if (t.includes('graduate') || t.includes('fellow')) return 'FELLOWSHIP';
  return 'INTERNSHIP';
}

function extractCountryFromLocations(locations: { name: string }[]): string {
  for (const loc of locations) {
    const n = loc.name.toLowerCase();
    if (n.includes('italy') || n.includes('milan') || n.includes('rome') || n.includes('roma')) return 'IT';
    if (n.includes('germany') || n.includes('berlin') || n.includes('munich') || n.includes('münchen') || n.includes('frankfurt') || n.includes('hamburg')) return 'DE';
    if (n.includes('france') || n.includes('paris') || n.includes('lyon')) return 'FR';
    if (n.includes('spain') || n.includes('madrid') || n.includes('barcelona')) return 'ES';
    if (n.includes('netherlands') || n.includes('amsterdam') || n.includes('rotterdam')) return 'NL';
    if (n.includes('united kingdom') || n.includes('london') || n.includes('uk')) return 'GB';
    if (n.includes('ireland') || n.includes('dublin')) return 'IE';
    if (n.includes('austria') || n.includes('vienna') || n.includes('wien')) return 'AT';
    if (n.includes('belgium') || n.includes('brussels') || n.includes('bruxelles')) return 'BE';
    if (n.includes('switzerland') || n.includes('zurich') || n.includes('zürich')) return 'CH';
    if (n.includes('sweden') || n.includes('stockholm')) return 'SE';
    if (n.includes('poland') || n.includes('warsaw')) return 'PL';
  }
  return 'EU';
}

function isRemoteFromLocations(locations: { name: string }[]): boolean {
  return locations.some(l => {
    const n = l.name.toLowerCase();
    return n.includes('remote') || n.includes('flexible');
  });
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface MuseJob {
  id: number;
  name: string;
  contents: string;
  publication_date: string;
  short_name: string;
  locations: { name: string }[];
  categories: { name: string }[];
  levels: { name: string }[];
  refs: { landing_page: string };
  company: { id: number; short_name: string; name: string };
}

interface MuseResponse {
  page: number;
  page_count: number;
  results: MuseJob[];
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importMuseOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[TheMuse] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'themuse', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    const seenIds = new Set<number>();

    for (const level of LEVELS) {
      for (const location of EU_LOCATIONS) {
        for (let page = 0; page < MAX_PAGES; page++) {
          try {
            const params = new URLSearchParams({
              page: String(page),
              level,
              location,
            });
            if (MUSE_API_KEY) params.set('api_key', MUSE_API_KEY);

            const url = `${API_BASE}?${params.toString()}`;
            logger.info(`[TheMuse] ${level}/${location} page ${page}...`);

            const res = await fetch(url, {
              signal: AbortSignal.timeout(15000),
              headers: { 'Accept': 'application/json' },
            });

            if (res.status === 403) {
              logger.warn(`[TheMuse] Rate limited — pausing 60s`);
              await new Promise(r => setTimeout(r, 60000));
              continue;
            }

            if (!res.ok) {
              logger.warn(`[TheMuse] ${level}/${location} page ${page} returned ${res.status}`);
              break;
            }

            const body = await res.json() as MuseResponse;
            const jobs = body.results || [];

            if (jobs.length === 0) break;

            for (const job of jobs) {
              // Deduplicate by ID within run
              if (seenIds.has(job.id)) { skipped++; continue; }
              seenIds.add(job.id);

              const description = stripHtml(job.contents).slice(0, 10000)
                || `${job.name} at ${job.company.name}`;
              const locationStr = job.locations.map(l => l.name).join(', ');
              const country = extractCountryFromLocations(job.locations);
              const isAbroad = country !== 'IT';
              const isRemote = isRemoteFromLocations(job.locations);
              const categories = job.categories.map(c => c.name).slice(0, 5);
              const sid = `themuse-${job.id}`;

              const validated = validateOpportunity({
                title: `${job.name} — ${job.company.name}`,
                description,
                company: job.company.name || '',
                url: job.refs.landing_page || null,
                location: locationStr,
                isAbroad,
                isRemote,
                expiresAt: null,
              }, 'themuse');

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
                  type: mapType(job.levels, job.name),
                  tags: categories,
                  source: 'The Muse',
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
                  type: mapType(job.levels, job.name),
                  tags: categories,
                  postedAt: job.publication_date ? new Date(job.publication_date) : now,
                  source: 'The Muse',
                  sourceId: sid,
                  lastSyncedAt: now,
                },
              });
              imported++;
            }

            // Stop if last page
            if (page >= body.page_count - 1) break;

            // Respectful delay
            await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
          } catch (err) {
            logger.warn(`[TheMuse] ${level}/${location} page ${page} failed: ${err}`);
            break;
          }
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

    logger.info(`[TheMuse] Imported ${imported}, skipped ${skipped}`);
    return { imported, skipped, source: 'themuse' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[TheMuse] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
