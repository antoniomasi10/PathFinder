/**
 * Stage4eu Data Import — HTML Scraper
 * Source: https://stage4eu.it/annunci
 *
 * Stage4eu is a curated Italian portal listing internships across Europe.
 * The site is server-rendered HTML (Joomla) — no headless browser needed.
 *
 * Flow:
 *  1. Fetch the listings page (/annunci?start=0,20,40,…)
 *  2. Parse each card: title, company, location, sector, date, detail URL
 *  3. For each listing, fetch the detail page to get the full description
 *  4. Validate and upsert into the Opportunity table
 *
 * Runs weekly on Monday at 03:30 via scheduler.ts (alongside EU Youth).
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = 'https://stage4eu.it';
const LISTINGS_PATH = '/annunci';
const RESULTS_PER_PAGE = 20;
/** Max pages to scrape (20 results/page). 10 pages = 200 listings. */
const MAX_PAGES = 10;
/** Delay between fetches to be respectful (ms) */
const FETCH_DELAY_MS = 1000;
/** Max detail pages to fetch per run (descriptions are fetched individually) */
const MAX_DETAILS = 150;

// Country name (Italian) → ISO code mapping
const PAESE_ISO: Record<string, string> = {
  'italia': 'IT', 'belgio': 'BE', 'francia': 'FR', 'germania': 'DE',
  'spagna': 'ES', 'paesi bassi': 'NL', 'olanda': 'NL', 'svizzera': 'CH',
  'austria': 'AT', 'portogallo': 'PT', 'irlanda': 'IE', 'lussemburgo': 'LU',
  'danimarca': 'DK', 'svezia': 'SE', 'norvegia': 'NO', 'finlandia': 'FI',
  'grecia': 'GR', 'polonia': 'PL', 'repubblica ceca': 'CZ', 'ungheria': 'HU',
  'romania': 'RO', 'bulgaria': 'BG', 'croazia': 'HR', 'slovacchia': 'SK',
  'slovenia': 'SI', 'estonia': 'EE', 'lettonia': 'LV', 'lituania': 'LT',
  'cipro': 'CY', 'malta': 'MT', 'regno unito': 'GB',
  'belgium': 'BE', 'france': 'FR', 'germany': 'DE', 'spain': 'ES',
  'netherlands': 'NL', 'switzerland': 'CH',
  'portugal': 'PT', 'ireland': 'IE', 'luxembourg': 'LU',
  'denmark': 'DK', 'sweden': 'SE', 'norway': 'NO', 'finland': 'FI',
  'greece': 'GR', 'poland': 'PL', 'czech republic': 'CZ', 'hungary': 'HU',
  'italy': 'IT', 'united kingdom': 'GB',
};

// ---------------------------------------------------------------------------
// HTML Parsing helpers (regex-based, no DOM library needed)
// ---------------------------------------------------------------------------

/**
 * Extract text content between a regex match and the next closing tag.
 * Simple but effective for well-structured server-rendered HTML.
 */
function extractText(html: string, regex: RegExp): string {
  const match = html.match(regex);
  if (!match) return '';
  return match[1]
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract country ISO code from a location string like "Paris, Francia" */
function extractCountryCode(location: string): string {
  const parts = location.split(',');
  const lastPart = parts[parts.length - 1]?.trim().toLowerCase() || '';
  return PAESE_ISO[lastPart] || '';
}

// ---------------------------------------------------------------------------
// Scraping — Listings page
// ---------------------------------------------------------------------------

interface ListingCard {
  title: string;
  company: string;
  detailUrl: string;
  location: string;
  sector: string;
  dateStr: string;
  slug: string; // unique ID from URL
}

/** Parse listing cards from the /annunci HTML page */
function parseListings(html: string): ListingCard[] {
  const cards: ListingCard[] = [];

  // Match each card block
  const cardRegex = /<div class="card-body">([\s\S]*?)<\/div>\s*<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const block = match[1];

    // Date: <h6 class="card-subtitle mb-2 text-muted">08/04/2026</h6>
    const dateStr = extractText(block, /<h6[^>]*card-subtitle[^>]*>(.*?)<\/h6>/);

    // Title + URL: <h5 class="card-title"><a href="...">Company, Title</a></h5>
    const titleMatch = block.match(/<h5[^>]*card-title[^>]*>\s*<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    const detailUrl = titleMatch[1];
    const fullTitle = titleMatch[2]
      .replace(/<[^>]*>/g, '')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();

    // Split "Company, Title" format
    const commaIdx = fullTitle.indexOf(',');
    let company = '';
    let title = fullTitle;
    if (commaIdx > 0) {
      company = fullTitle.slice(0, commaIdx).trim();
      title = fullTitle.slice(commaIdx + 1).trim();
    }

    // Location: <p class="card-text small"><strong>Paese:</strong> ...</p>
    const location = extractText(block, /<strong>Paese:<\/strong>\s*(.*?)<\/p>/);

    // Sector: <p class="card-text small"><strong>Settore:</strong> ...</p>
    const sector = extractText(block, /<strong>Settore:<\/strong>\s*(.*?)<\/p>/);

    // Extract slug from URL for unique ID
    const slugMatch = detailUrl.match(/annuncio\/(\d+[-\w]*)/);
    const slug = slugMatch ? slugMatch[1] : '';

    if (title && slug) {
      cards.push({ title, company, detailUrl, location, sector, dateStr, slug });
    }
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Scraping — Detail page
// ---------------------------------------------------------------------------

interface DetailData {
  description: string;
  requirements: string;
  duration: string;
  isPaid: boolean;
  applicationUrl: string;
}

/** Fetch and parse a detail page for full description */
async function fetchDetail(url: string): Promise<DetailData | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const res = await fetch(fullUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Description (Attività)
    const descMatch = html.match(/<span class="label">Attivit[àa]:<\/span>\s*<span>([\s\S]*?)<\/span>/);
    const description = descMatch
      ? descMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    // Requirements
    const reqMatch = html.match(/<span class="label">Requisiti principali:<\/span>\s*<span>([\s\S]*?)<\/span>/);
    const requirements = reqMatch
      ? reqMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    // Duration (e.g., "6 mesi")
    const durMatch = html.match(/fa-calendar[\s\S]*?<\/span>\s*<span>([\s\S]*?)<\/span>/);
    const duration = durMatch ? durMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() : '';

    // Paid?
    const isPaid = /Retribuito/i.test(html);

    // Application URL
    const appMatch = html.match(/<a\s+class="link-offerta"\s+href="([^"]*)"/);
    const applicationUrl = appMatch ? appMatch[1] : '';

    return { description, requirements, duration, isPaid, applicationUrl };
  } catch (err) {
    logger.warn(`[Stage4eu] Detail fetch failed for ${url}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

function mapType(title: string, sector: string): OpportunityType {
  const t = `${title} ${sector}`.toLowerCase();
  if (t.includes('stage') || t.includes('tirocinio')) return 'STAGE';
  if (t.includes('fellow')) return 'FELLOWSHIP';
  if (t.includes('event') || t.includes('workshop')) return 'EVENT';
  return 'INTERNSHIP'; // Stage4eu is primarily internships
}

/** Parse duration string like "6 mesi" to months */
function parseDuration(dur: string): number | null {
  const m = dur.match(/(\d+)\s*mes/i);
  return m ? parseInt(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importStage4euOpportunities(options?: {
  maxPages?: number;
  maxDetails?: number;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[Stage4eu] Starting opportunity import...');
  const now = new Date();
  const maxPages = options?.maxPages || MAX_PAGES;
  const maxDetails = options?.maxDetails || MAX_DETAILS;

  const log = await prisma.importLog.create({
    data: { source: 'stage4eu', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let detailsFetched = 0;
    const allCards: ListingCard[] = [];

    // Step 1: Fetch listing pages
    for (let page = 0; page < maxPages; page++) {
      const start = page * RESULTS_PER_PAGE;
      const url = `${BASE_URL}${LISTINGS_PATH}?view=annunci&layout=list&start=${start}`;
      logger.info(`[Stage4eu] Fetching listings page ${page + 1} (start=${start})...`);

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          logger.warn(`[Stage4eu] Page ${page + 1} returned ${res.status}`);
          break;
        }
        const html = await res.text();
        const cards = parseListings(html);

        if (cards.length === 0) {
          logger.info(`[Stage4eu] No more listings on page ${page + 1}`);
          break;
        }

        allCards.push(...cards);
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[Stage4eu] Listings page ${page + 1} failed: ${err}`);
        break;
      }
    }

    logger.info(`[Stage4eu] Found ${allCards.length} listings, fetching details...`);

    // Step 2: Fetch details + upsert
    for (const card of allCards) {
      if (detailsFetched >= maxDetails) break;

      const sid = `stage4eu-${card.slug}`;
      const countryCode = extractCountryCode(card.location);
      const isAbroad = countryCode !== 'IT';

      // Fetch detail page for description
      let detail: DetailData | null = null;
      if (detailsFetched < maxDetails) {
        detail = await fetchDetail(card.detailUrl);
        detailsFetched++;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      }

      const fullDescription = detail
        ? [detail.description, detail.requirements].filter(Boolean).join('\n\nRequisiti:\n')
        : `${card.title} - ${card.company} - ${card.sector}`;

      const validated = validateOpportunity({
        title: card.title,
        description: fullDescription,
        company: card.company,
        url: detail?.applicationUrl || card.detailUrl,
        location: card.location,
        isAbroad,
        isRemote: card.title.toLowerCase().includes('remote'),
        expiresAt: null,
      }, 'stage4eu');

      if (!validated) { skipped++; continue; }

      const tags = card.sector
        .split(/[,\/]/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 5);

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
          type: mapType(card.title, card.sector),
          tags,
          source: 'Stage4eu',
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
          type: mapType(card.title, card.sector),
          tags,
          source: 'Stage4eu',
          sourceId: sid,
          lastSyncedAt: now,
        },
      });
      imported++;
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, detailsFetched, totalCards: allCards.length },
      },
    });

    logger.info(`[Stage4eu] Imported ${imported}, skipped ${skipped} (${detailsFetched} details fetched)`);
    return { imported, skipped, source: 'stage4eu' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Stage4eu] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
