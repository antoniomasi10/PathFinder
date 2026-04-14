/**
 * EURES (EU Employment Services) Data Import — Playwright Scraper
 * Source: https://europa.eu/eures/portal/jv-se/search
 *
 * The EURES search API is CSRF-protected and not publicly accessible.
 * This scraper uses Playwright (headless Chromium) to load the search page,
 * wait for the Angular SPA to render results, then extract job data from the DOM.
 *
 * Runs daily at 03:00 via scheduler.ts.
 * Records get `sourceId` + `lastSyncedAt` for freshness tracking.
 * Expired/stale records are cleaned by cleanup.service.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EURES_SEARCH_URL = 'https://europa.eu/eures/portal/jv-se/search';

/** Search queries targeting student opportunities */
const SEARCH_QUERIES = [
  // English terms
  { keyword: 'internship', positionCodes: 'internship' },
  { keyword: 'traineeship', positionCodes: 'internship' },
  { keyword: 'stage', positionCodes: 'internship' },
  { keyword: 'graduate programme', positionCodes: '' },
  { keyword: 'summer job student', positionCodes: 'seasonal' },
  { keyword: 'research assistant', positionCodes: '' },
  // Italian terms
  { keyword: 'tirocinio', positionCodes: 'internship' },
  { keyword: 'tirocinio curriculare', positionCodes: 'internship' },
  { keyword: 'apprendistato', positionCodes: 'apprenticeship' },
  { keyword: 'neolaureato', positionCodes: '' },
];

/** Max pages to scrape per search query (10 results per page) */
const MAX_PAGES_PER_QUERY = 3;
const RESULTS_PER_PAGE = 10;
/** Delay between page loads to be respectful (ms) */
const PAGE_DELAY_MS = 5000;

/**
 * Identifiable User-Agent so EURES operators can contact us if needed.
 * Contact email must be configurable via env (EURES_CONTACT_EMAIL).
 */
const CONTACT_EMAIL = process.env.EURES_CONTACT_EMAIL || 'contact@pathfinder.example';
const USER_AGENT = `PathFinderBot/1.0 (+https://pathfinder.example; ${CONTACT_EMAIL}) Chrome/120.0.0.0`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a job title + description to an OpportunityType enum value */
function mapType(title: string, desc: string): OpportunityType {
  const t = `${title} ${desc}`.toLowerCase();
  if (t.includes('stage') || t.includes('tirocinio')) return 'STAGE';
  if (t.includes('intern') || t.includes('traineeship')) return 'INTERNSHIP';
  if (t.includes('fellow')) return 'FELLOWSHIP';
  if (t.includes('event') || t.includes('workshop')) return 'EVENT';
  return 'INTERNSHIP';
}

/** Build a EURES search URL with query parameters */
function buildSearchUrl(keyword: string, positionCodes: string, pageNum: number): string {
  const params = new URLSearchParams({
    keywordsEverywhere: keyword,
    lang: 'en',
    page: String(pageNum),
    resultsPerPage: String(RESULTS_PER_PAGE),
    sortField: 'MOST_RECENT',
  });
  if (positionCodes) {
    params.set('positionOfferingCodes', positionCodes);
  }
  return `${EURES_SEARCH_URL}?${params.toString()}`;
}

/** Extract a stable ID from a EURES detail URL (e.g. "NTczMzg4NSAy" from the path) */
function extractIdFromUrl(url: string): string | null {
  const match = url.match(/jv-details\/([^?]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Scraping
// ---------------------------------------------------------------------------

interface ScrapedJob {
  title: string;
  description: string;
  company: string;
  location: string;
  country: string;
  schedule: string;
  publishDate: string;
  detailUrl: string;
  euresId: string;
  categories: string[];
}

/**
 * Scrape a single search results page.
 * Returns the jobs found on that page.
 */
async function scrapePage(
  page: any,
  url: string,
): Promise<ScrapedJob[]> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  // Wait for Angular to render the result cards
  await page.waitForTimeout(4000);

  // Check if there are results
  const resultLinks = await page.locator('a[href*="jv-se/jv-detail"]').count();
  if (resultLinks === 0) return [];

  // Extract job data from the DOM (runs inside the browser context).
  // We use Function cast to avoid TS DOM lib errors — this code only executes in Chromium.
  const extractJobs = new Function(`
    var cards = Array.from(document.querySelectorAll('ecl-content-block'));
    return cards.map(function(card, i) {
      var link = card.querySelector('h3 a');
      var title = link ? link.textContent.trim() : '';
      var detailUrl = link ? (link.href || link.getAttribute('href') || '') : '';
      var descEl = card.querySelector('.ecl-content-block__description');
      var desc = descEl ? descEl.textContent.trim() : '';
      var compEl = document.getElementById('jv-employer-name-' + i);
      var company = compEl ? compEl.textContent.trim() : '';
      var locEl = document.getElementById('location-' + i + '-0');
      if (!locEl) { locEl = card.querySelector('[id^="location-"]'); }
      if (!locEl) { locEl = card.querySelector('.location, .ecl-content-block__location'); }
      var location = locEl ? locEl.textContent.trim().replace(/\\s+/g, ' ') : '';
      var country = '';
      if (locEl && locEl.childNodes[0]) { country = locEl.childNodes[0].textContent.trim(); }
      var schedEl = document.getElementById('position-schedule-' + i + '-0');
      var schedule = schedEl ? schedEl.textContent.trim() : '';
      var dateEl = document.getElementById('date-' + i);
      var publishDate = dateEl ? dateEl.textContent.replace('Publication date:', '').trim() : '';
      var catEls = Array.from(card.querySelectorAll('.ecl-description-list__definition-item'));
      var categories = catEls.map(function(el) { return el.textContent.trim(); }).filter(Boolean);
      var idMatch = detailUrl.match(/jv-details\\/([^?]+)/);
      var euresId = idMatch ? idMatch[1] : Date.now() + '-' + i;
      return { title: title, description: desc, company: company, location: location, country: country, schedule: schedule, publishDate: publishDate, detailUrl: detailUrl, euresId: euresId, categories: categories };
    });
  `) as () => ScrapedJob[];
  const jobs: ScrapedJob[] = await page.evaluate(extractJobs);

  return jobs.filter(j => j.title.length > 0);
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

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
  queries?: typeof SEARCH_QUERIES;
  maxPages?: number;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[EURES] Starting opportunity import (Playwright scraper)...');
  const now = new Date();
  const queries = options?.queries || SEARCH_QUERIES;
  const maxPages = options?.maxPages || MAX_PAGES_PER_QUERY;

  // Dynamically import Playwright so the backend doesn't fail if Playwright
  // isn't installed (e.g. in test environments or CI without browsers).
  let chromium: any;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    logger.warn('[EURES] Playwright not installed — skipping scrape. Install with: npm install playwright && npx playwright install chromium');
    return { imported: 0, skipped: 0, source: 'playwright-unavailable' };
  }

  let browser: any = null;

  try {
    const result = await logImport(async () => {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
      });
      const page = await context.newPage();

      let imported = 0;
      let skipped = 0;
      const seenIds = new Set<string>();

      for (const query of queries) {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          try {
            const url = buildSearchUrl(query.keyword, query.positionCodes, pageNum);
            logger.info(`[EURES] Scraping "${query.keyword}" page ${pageNum}...`);

            const jobs = await scrapePage(page, url);
            if (jobs.length === 0) {
              logger.info(`[EURES] No results for "${query.keyword}" page ${pageNum}, moving on.`);
              break;
            }

            for (const job of jobs) {
              // Skip duplicates within this run
              if (seenIds.has(job.euresId)) { skipped++; continue; }
              seenIds.add(job.euresId);

              const isAbroad = !job.country.toLowerCase().includes('italy') && !job.country.toLowerCase().includes('italia');
              const isRemote = job.title.toLowerCase().includes('remote') || job.description.toLowerCase().includes('remote');

              // Validate before upserting
              const validated = validateOpportunity({
                title: job.title,
                description: job.description || `${job.title} - ${job.company}`,
                company: job.company,
                url: job.detailUrl || null,
                location: job.location,
                isAbroad,
                isRemote,
                expiresAt: null,
              }, 'eures');

              if (!validated) { skipped++; continue; }

              const sid = `eures-${job.euresId}`;
              const tags = [query.keyword, ...job.categories].slice(0, 10);

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
                  type: mapType(job.title, job.description),
                  tags,
                  source: 'EURES',
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
                  type: mapType(job.title, job.description),
                  tags,
                  source: 'EURES',
                  sourceId: sid,
                  lastSyncedAt: now,
                },
              });
              imported++;
            }

            // Be respectful — wait between page loads
            await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
          } catch (err) {
            logger.warn(`[EURES] "${query.keyword}" page ${pageNum} failed: ${err}`);
            break;
          }
        }
      }

      await context.close();
      return { imported, skipped };
    });

    logger.info(`[EURES] Imported ${result.imported}, skipped ${result.skipped}`);
    return { ...result, source: 'eures-playwright' };
  } catch (err) {
    const existing = await prisma.opportunity.count({ where: { sourceId: { startsWith: 'eures-' } } });
    if (existing > 0) {
      logger.warn(`[EURES] Scrape failed but DB has ${existing} cached opportunities`);
      return { imported: 0, skipped: 0, source: 'db-cache' };
    }
    logger.error(`[EURES] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'none' };
  } finally {
    await browser?.close().catch(() => {});
  }
}
