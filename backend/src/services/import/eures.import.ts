/**
 * EURES (EU Employment Services) Data Import
 * Source: https://europa.eu/eures
 *
 * Live API — fetches internships/stage opportunities daily.
 * Records get `sourceId` + `lastSyncedAt` for freshness tracking.
 * Expired/stale records are cleaned by cleanup.service.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { translateOpportunity } from '../translation.service';
import { validateOpportunity } from './validation';

const EURES_SEARCH = 'https://europa.eu/eures/eures-searchengine/page/jv-search/search';

function mapType(title: string, desc: string): OpportunityType {
  const t = `${title} ${desc}`.toLowerCase();
  if (t.includes('stage') || t.includes('tirocinio')) return 'STAGE';
  if (t.includes('intern')) return 'INTERNSHIP';
  if (t.includes('fellow')) return 'FELLOWSHIP';
  if (t.includes('event') || t.includes('workshop')) return 'EVENT';
  return 'INTERNSHIP';
}

async function searchJobs(keyword: string, country: string, offset = 0, limit = 50) {
  const body = {
    keywords: [keyword],
    locationCodes: [country],
    experienceCodes: ['1'],
    offset,
    limit,
    sortField: 'MOST_RECENT',
  };

  const res = await fetch(EURES_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`EURES ${res.status}`);
  const data = await res.json() as any;
  const items = data.data?.items || data.items || data.results || [];
  const total = data.data?.totalCount || data.totalCount || 0;
  return { items, total };
}

async function logImport(fn: () => Promise<{ imported: number; skipped: number }>): Promise<{ imported: number; skipped: number }> {
  const log = await prisma.importLog.create({
    data: { source: 'eures', type: 'opportunities', status: 'running', startedAt: new Date() },
  });
  try {
    const result = await fn();
    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: result.imported,
        finishedAt: new Date(),
        metadata: { skipped: result.skipped },
      },
    });
    return result;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    throw err;
  }
}

export async function importOpportunities(options?: {
  keywords?: string[];
  countries?: string[];
  maxPages?: number;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[EURES] Starting opportunity import...');
  const now = new Date();

  const keywords = options?.keywords || [
    // English terms
    'internship', 'stage', 'research assistant', 'junior developer',
    'data analyst junior', 'marketing intern', 'graduate programme',
    // Italian terms
    'tirocinio', 'tirocinio curriculare', 'neolaureato',
    'primo impiego', 'apprendistato',
    // Specific fields popular with Italian students
    'ingegneria', 'economia', 'design junior', 'comunicazione',
  ];
  const countries = options?.countries || ['IT'];
  const maxPages = options?.maxPages || 3;

  try {
    const result = await logImport(async () => {
      let imported = 0;
      let skipped = 0;

      for (const kw of keywords) {
        for (let page = 0; page < maxPages; page++) {
          try {
            const { items, total } = await searchJobs(kw, countries[0], page * 50, 50);
            if (items.length === 0) break;

            for (const job of items) {
              const title = job.general?.title?.trim() || job.title?.trim();
              if (!title) { skipped++; continue; }

              const desc = (job.general?.description || job.description || '').slice(0, 5000);
              const company = job.general?.organizationName || job.company || '';
              const city = job.location?.city || '';
              const countryCode = job.location?.countryCode || 'IT';
              const handle = job.header?.handle || job.id || `${Date.now()}-${imported}`;
              const url = job.related?.urls?.[0]?.url || job.url || null;
              const expires = job.expirationDate ? new Date(job.expirationDate) : null;

              // Validate before upsert
              const validated = validateOpportunity({
                title, description: desc, company, url,
                location: [city, countryCode].filter(Boolean).join(', '),
                isAbroad: countryCode !== 'IT',
                isRemote: title.toLowerCase().includes('remote'),
                expiresAt: expires,
              }, 'eures');

              if (!validated) { skipped++; continue; }

              const sid = `eures-${handle}`;
              const exists = await prisma.opportunity.findUnique({ where: { id: sid }, select: { id: true } });

              if (exists) {
                // Already translated — only refresh metadata, never overwrite content
                await prisma.opportunity.update({
                  where: { id: sid },
                  data: { expiresAt: expires, lastSyncedAt: now },
                });
              } else {
                // New opportunity: translate title + description before saving
                const translated = await translateOpportunity(validated.title, validated.description);
                await prisma.opportunity.create({
                  data: {
                    id: sid,
                    title: translated.title.slice(0, 200),
                    description: translated.description.slice(0, 5000),
                    company: validated.company, url: validated.url,
                    location: validated.location,
                    isAbroad: validated.isAbroad,
                    isRemote: validated.isRemote,
                    type: mapType(title, desc),
                    expiresAt: validated.expiresAt,
                    tags: [kw],
                    sourceId: sid,
                    lastSyncedAt: now,
                  },
                });
              }
              imported++;
            }

            if ((page + 1) * 50 >= total) break;
            await new Promise(r => setTimeout(r, 1000)); // rate limit
          } catch (err) {
            logger.warn(`[EURES] "${kw}" page ${page} failed: ${err}`);
            break;
          }
        }
      }
      return { imported, skipped };
    });

    logger.info(`[EURES] Imported ${result.imported}, skipped ${result.skipped}`);
    return { ...result, source: 'eures-api' };
  } catch (err) {
    const existing = await prisma.opportunity.count({ where: { sourceId: { startsWith: 'eures-' } } });
    if (existing > 0) {
      logger.warn(`[EURES] API failed but DB has ${existing} cached opportunities`);
      return { imported: 0, skipped: 0, source: 'db-cache' };
    }
    logger.error(`[EURES] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'none' };
  }
}
