/**
 * Bundesagentur für Arbeit (German Federal Employment Agency) Import
 * Source: https://jobsuche.api.bund.dev/
 *
 * Germany's largest job database — free, open, no registration required.
 * Covers enterprise companies: Bosch, Siemens, BMW, SAP, Deutsche Bank, etc.
 *
 * Auth: fixed public header X-API-Key: jobboerse-jobsuche
 * Legal: public government data, no usage restrictions.
 *
 * Runs weekly Thursday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs';
const API_DETAIL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails';

const API_KEY = 'jobboerse-jobsuche';

/** Search queries targeting student/intern roles */
const QUERIES = [
  'Praktikum',
  'Werkstudent',
  'Trainee',
  'Internship',
  'Volontariat',
  'Duales Studium',
];

/** Max pages per query (default page size is 25) */
const MAX_PAGES = 10;

/** Delay between API calls (ms) */
const REQUEST_DELAY_MS = 800;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashId(refnr: string): string {
  return createHash('sha256').update(refnr).digest('hex').slice(0, 16);
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

function mapType(title: string, query: string): OpportunityType {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  if (q === 'praktikum' || t.includes('praktikum') || t.includes('stage') || t.includes('tirocinio')) return 'STAGE';
  if (q === 'werkstudent' || t.includes('werkstudent')) return 'STAGE';
  if (q === 'internship' || t.includes('intern')) return 'INTERNSHIP';
  if (q === 'trainee' || t.includes('trainee')) return 'INTERNSHIP';
  if (q === 'volontariat' || t.includes('volontariat')) return 'EXTRACURRICULAR';
  if (q === 'duales studium' || t.includes('duales studium')) return 'STAGE';
  if (t.includes('fellow') || t.includes('graduate')) return 'FELLOWSHIP';
  return 'INTERNSHIP';
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface BAAJob {
  refnr: string;
  titel: string;
  arbeitgeber: string;
  arbeitsort: {
    ort: string;
    plz: string;
    region: string;
    land: string;
  };
  beruf: string;
  eintrittsdatum: string;
  aktuelleVeroeffentlichungsdatum: string;
  modifikationsTimestamp: string;
  externeUrl?: string;
  logoHashId?: string;
}

interface BAASearchResponse {
  stellenangebote: BAAJob[];
  maxErgebnisse: number;
  page: number;
  size: number;
}

interface BAAJobDetail {
  stellenangebotsTitel: string;
  stellenangebotsBeschreibung: string;
  homeofficemoeglich?: boolean;
  externeUrl?: string;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importBundesagenturOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[Bundesagentur] Starting opportunity import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'bundesagentur', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    const seenRefs = new Set<string>();

    const headers: Record<string, string> = {
      'X-API-Key': API_KEY,
      'Accept': 'application/json',
    };

    for (const query of QUERIES) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        try {
          const params = new URLSearchParams({
            was: query,
            size: '25',
            page: String(page),
          });

          const url = `${API_BASE}?${params.toString()}`;
          logger.info(`[Bundesagentur] "${query}" page ${page}...`);

          const res = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers,
          });

          if (!res.ok) {
            logger.warn(`[Bundesagentur] "${query}" page ${page} returned ${res.status}`);
            break;
          }

          const body = await res.json() as BAASearchResponse;
          const jobs = body.stellenangebote || [];

          if (jobs.length === 0) break;

          for (const job of jobs) {
            if (!job.refnr || seenRefs.has(job.refnr)) { skipped++; continue; }
            seenRefs.add(job.refnr);

            // Fetch detail for full description
            let description = `${job.titel} — ${job.arbeitgeber}`;
            try {
              const encodedRef = Buffer.from(job.refnr).toString('base64');
              const detailRes = await fetch(`${API_DETAIL}/${encodedRef}`, {
                signal: AbortSignal.timeout(10000),
                headers,
              });
              if (detailRes.ok) {
                const detail = await detailRes.json() as BAAJobDetail;
                description = stripHtml(detail.stellenangebotsBeschreibung || '').slice(0, 10000) || description;
              }
            } catch {
              // Use fallback description from listing
            }

            const locationParts = [job.arbeitsort?.ort, job.arbeitsort?.region].filter(Boolean);
            const location = locationParts.length > 0
              ? `${locationParts.join(', ')}, Germany`
              : 'Germany';
            const isRemote = job.titel?.toLowerCase().includes('remote')
              || job.titel?.toLowerCase().includes('homeoffice');
            const sid = `bundesagentur-${hashId(job.refnr)}`;

            // Build URL: external URL or Arbeitsagentur search page
            const jobUrl = job.externeUrl || `https://www.arbeitsagentur.de/jobsuche/suche?was=${encodeURIComponent(job.titel)}&id=${encodeURIComponent(job.refnr)}`;

            const validated = validateOpportunity({
              title: `${job.titel} — ${job.arbeitgeber}`,
              description,
              company: job.arbeitgeber || '',
              url: jobUrl,
              location,
              isAbroad: true,
              isRemote,
              expiresAt: null,
            }, 'bundesagentur');

            if (!validated) { skipped++; continue; }

            const tags = [query, 'Germany'].slice(0, 5);

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
                type: mapType(job.titel, query),
                tags,
                source: 'Bundesagentur für Arbeit',
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
                type: mapType(job.titel, query),
                tags,
                postedAt: job.aktuelleVeroeffentlichungsdatum
                  ? new Date(job.aktuelleVeroeffentlichungsdatum)
                  : now,
                source: 'Bundesagentur für Arbeit',
                sourceId: sid,
                lastSyncedAt: now,
              },
            });
            imported++;

            // Delay between detail fetches
            await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
          }

          // Check if we've reached the end
          const totalPages = Math.ceil((body.maxErgebnisse || 0) / 25);
          if (page >= totalPages - 1) break;

          // Delay between search pages
          await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
        } catch (err) {
          logger.warn(`[Bundesagentur] "${query}" page ${page} failed: ${err}`);
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

    logger.info(`[Bundesagentur] Imported ${imported}, skipped ${skipped}`);
    return { imported, skipped, source: 'bundesagentur' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Bundesagentur] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
