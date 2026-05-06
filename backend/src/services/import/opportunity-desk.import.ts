/**
 * Opportunity Desk — RSS Feed Import
 * Source: https://opportunitydesk.org/feed/ (WordPress category feeds)
 *
 * Opportunity Desk aggregates global opportunities: fellowships, competitions,
 * research grants, scholarships, volunteering, conferences, and internships.
 * The RSS feeds are public (WordPress standard /feed/ endpoints, no auth).
 * We subscribe to 8 category-specific feeds to maximize coverage and improve
 * OpportunityType classification accuracy over the generic main feed.
 *
 * Attribution: "via Opportunity Desk (opportunitydesk.org)" — included in source field.
 *
 * Runs every 2 days (Mon/Wed/Fri) at 02:00 via scheduler.ts.
 */
import { FieldOfStudy, OpportunityType } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import {
  stripHtml,
  extractCountryCode,
  mapOpportunityType,
  normalizeFieldToEnum,
  fetchWithRetry,
  parseRSSFeed,
  fetchMetaDescription,
  type RSSItem,
} from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = 'https://opportunitydesk.org';
const FEED_DELAY_MS = 2000;   // delay between RSS feed fetches (rate-limiting)
const ENRICH_DELAY_MS = 300;  // delay between meta-description HTTP fetches
const SOURCE_KEY = 'opportunity-desk';

// Category feeds give better type classification and ~8x more items vs main feed.
// Each entry: [feedUrl, forcedType (or null = use category/title detection)]
const CATEGORY_FEEDS: Array<{ url: string; forcedType: OpportunityType | null }> = [
  { url: `${BASE_URL}/category/fellowships/feed/?posts_per_page=50`,    forcedType: 'FELLOWSHIP'   },
  { url: `${BASE_URL}/category/scholarships/feed/?posts_per_page=50`,   forcedType: 'FELLOWSHIP'   },
  { url: `${BASE_URL}/category/competitions/feed/?posts_per_page=50`,   forcedType: 'COMPETITION'  },
  { url: `${BASE_URL}/category/conferences/feed/?posts_per_page=50`,    forcedType: 'CONFERENCE'   },
  { url: `${BASE_URL}/category/internships/feed/?posts_per_page=50`,    forcedType: 'INTERNSHIP'   },
  { url: `${BASE_URL}/category/volunteering/feed/?posts_per_page=50`,   forcedType: 'VOLUNTEERING' },
  { url: `${BASE_URL}/category/exchange-programs/feed/?posts_per_page=50`, forcedType: 'EXCHANGE'  },
  { url: `${BASE_URL}/category/research/feed/?posts_per_page=50`,       forcedType: 'RESEARCH'     },
];

// ---------------------------------------------------------------------------
// Type mapping helpers
// ---------------------------------------------------------------------------

/**
 * Opportunity Desk posts include WordPress categories that map cleanly to
 * our OpportunityType enum. Category-based detection is more reliable than
 * pure title matching for OD content.
 */
const OD_CATEGORY_MAP: Record<string, OpportunityType> = {
  'fellowship':       'FELLOWSHIP',
  'fellowships':      'FELLOWSHIP',
  'scholarship':      'FELLOWSHIP',
  'scholarships':     'FELLOWSHIP',
  'grant':            'FELLOWSHIP',
  'grants':           'FELLOWSHIP',
  'competition':      'COMPETITION',
  'competitions':     'COMPETITION',
  'award':            'COMPETITION',
  'awards':           'COMPETITION',
  'challenge':        'COMPETITION',
  'conference':       'CONFERENCE',
  'conferences':      'CONFERENCE',
  'summit':           'CONFERENCE',
  'forum':            'CONFERENCE',
  'workshop':         'CONFERENCE',
  'internship':       'INTERNSHIP',
  'internships':      'INTERNSHIP',
  'volunteer':        'VOLUNTEERING',
  'volunteering':     'VOLUNTEERING',
  'exchange':         'EXCHANGE',
  'training':         'BOOTCAMP',
  'research':         'RESEARCH',
  'hackathon':        'HACKATHON',
  'summer program':   'SUMMER_PROGRAM',
  'summer school':    'SUMMER_PROGRAM',
};

function mapTypeFromCategories(categories: string[]): OpportunityType | null {
  for (const cat of categories) {
    const mapped = OD_CATEGORY_MAP[cat.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metadata extraction from RSS text content
// ---------------------------------------------------------------------------

/**
 * Extracts the application deadline from post text.
 * OD posts commonly include "Deadline: April 26, 2026" or similar.
 */
function extractDeadline(text: string): Date | null {
  const patterns = [
    /deadline[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /deadline[:\s]+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i,
    /apply\s+by[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /closing\s+date[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /application\s+deadline[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  ];

  const now = Date.now();
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const d = new Date(m[1]);
    if (!isNaN(d.getTime()) && d.getTime() > now) return d;
  }
  return null;
}

/**
 * Returns true if the opportunity appears to be funded/free for participants.
 */
function detectFunded(text: string): boolean {
  return /fully[\s-]funded|full\s+scholarship|all\s+expenses?\s+paid|travel\s+grant|no\s+cost|free\s+of\s+charge|stipend\s+provided|expenses?\s+covered/i.test(text);
}

/**
 * Extracts stipend/award amount in USD (converted to EUR approximation).
 * Returns null if not found.
 */
function extractStipend(text: string): number | null {
  const m =
    text.match(/\$\s*([0-9][0-9,]*)\s*(stipend|award|grant|prize|scholarship)/i) ||
    text.match(/(stipend|award|grant|prize|scholarship)[^$0-9]*\$\s*([0-9][0-9,]*)/i);
  if (!m) return null;
  const raw = (m[1] || m[2]).replace(/,/g, '');
  const amount = parseInt(raw, 10);
  return isNaN(amount) ? null : amount;
}

/**
 * Infers eligible fields from title + description keywords.
 * Returns empty array (= any field) when nothing specific detected.
 */
function extractEligibleFields(text: string): FieldOfStudy[] {
  const fields = new Set<FieldOfStudy>();
  const candidates = [
    'computer science', 'engineering', 'medicine', 'biology', 'physics',
    'chemistry', 'mathematics', 'economics', 'business', 'law', 'political',
    'humanities', 'design', 'architecture', 'psychology', 'education',
    'social science', 'data science', 'ai ', 'ml ', 'finance',
  ];
  const t = text.toLowerCase();
  for (const kw of candidates) {
    if (t.includes(kw)) {
      fields.add(normalizeFieldToEnum(kw));
    }
  }
  // Remove ANY — it's the fallback, not a useful positive signal
  fields.delete('ANY');
  return Array.from(fields);
}

/**
 * Derives a stable source ID from the post URL slug.
 * e.g. "https://opportunitydesk.org/2026/04/17/youth-will-lead-fellowship/"
 *   → "od-youth-will-lead-fellowship"
 */
function buildSourceId(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.replace(/\/$/, '').split('/').pop() ?? '';
    return `od-${slug.slice(0, 80)}`;
  } catch {
    return `od-${url.slice(-40).replace(/[^a-z0-9]/gi, '-')}`;
  }
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importOpportunityDeskOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[OpportunityDesk] Starting RSS import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let totalParsed = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    // Fetch all category feeds, deduplicating by sourceId across feeds
    for (const { url, forcedType } of CATEGORY_FEEDS) {
      await new Promise(r => setTimeout(r, FEED_DELAY_MS));
      try {
        const res = await fetchWithRetry(url, {
          timeoutMs: 20000,
          headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
          logTag: '[OpportunityDesk]',
          retries: 2,
        });

        if (!res.ok) {
          logger.warn(`[OpportunityDesk] Feed ${url} returned HTTP ${res.status} — skipping`);
          continue;
        }

        const xml = await res.text();
        const items = parseRSSFeed(xml);
        totalParsed += items.length;
        logger.info(`[OpportunityDesk] Feed ${url.split('/category/')[1]?.split('/')[0] ?? 'main'}: ${items.length} items`);

        for (const item of items) {
          try {
            processItem(item, now, records, batchIds, forcedType);
          } catch (err) {
            logger.warn(`[OpportunityDesk] Item error "${item.title?.slice(0, 50)}": ${err}`);
            skipped++;
          }
        }
      } catch (err) {
        logger.warn(`[OpportunityDesk] Feed fetch error for ${url}: ${err}`);
      }
    }

    logger.info(`[OpportunityDesk] Parsed ${totalParsed} items across ${CATEGORY_FEEDS.length} feeds, ${records.length} unique`);

    // Validate and filter
    const validRecords: OpportunityRecord[] = [];
    for (const r of records) {
      const v = validateOpportunity({
        title: r.title,
        description: r.description,
        company: r.company,
        url: r.url,
        location: r.location,
        isAbroad: r.isAbroad,
        isRemote: r.isRemote,
        expiresAt: r.expiresAt,
        organizer: r.organizer,
        startDate: r.startDate,
        cost: r.cost,
        hasScholarship: r.hasScholarship,
        stipend: r.stipend,
        eligibleFields: r.eligibleFields,
        country: r.country,
      }, SOURCE_KEY);

      if (!v) { skipped++; continue; }
      validRecords.push(r);
    }

    // Enrich sparse descriptions with article og:description (limit to 30 to keep runtime reasonable)
    let enriched = 0;
    for (const r of validRecords) {
      if (enriched >= 30) break;
      if (r.description.length >= 200) continue;
      const meta = await fetchMetaDescription(r.url ?? '');
      if (meta && meta.length > r.description.length) {
        r.description = meta.slice(0, 2000);
        enriched++;
      }
      await new Promise(res => setTimeout(res, ENRICH_DELAY_MS));
    }
    if (enriched > 0) logger.info(`[OpportunityDesk] Enriched ${enriched} sparse descriptions`);

    await batchUpsertOpportunities(validRecords);

    // Mark opportunities no longer appearing in any feed as expired.
    // Threshold = 20 to avoid mass-expiry if OD has a partial outage on one run.
    const seenIds = validRecords.map(r => r.id);
    await markStaleOpportunities(SOURCE_KEY, seenIds, { minSeenForStale: 20 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: validRecords.length,
        finishedAt: new Date(),
        metadata: { skipped, totalParsed, feeds: CATEGORY_FEEDS.length },
      },
    });

    logger.info(`[OpportunityDesk] Imported ${validRecords.length}, skipped ${skipped}`);
    return { imported: validRecords.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[OpportunityDesk] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}

function processItem(
  item: RSSItem,
  now: Date,
  records: OpportunityRecord[],
  batchIds: Set<string>,
  forcedType: OpportunityType | null = null,
): void {
  const sid = buildSourceId(item.link);
  if (batchIds.has(sid)) return;
  batchIds.add(sid);

  const fullText = `${item.title} ${item.description}`;

  // Type resolution: forced (from category feed URL) > RSS categories > title heuristics
  const type: OpportunityType =
    forcedType ??
    mapTypeFromCategories(item.categories) ??
    mapOpportunityType(item.title);

  // Extract metadata
  const deadline = extractDeadline(fullText);
  const funded = detectFunded(fullText);
  const stipend = extractStipend(fullText);
  const eligibleFields = extractEligibleFields(fullText);

  // Location / country
  const locationMatch = fullText.match(
    /\b(italy|italia|germany|deutschland|france|spain|uk|united kingdom|usa|united states|netherlands|austria|switzerland|sweden|norway|denmark|finland|belgium|poland|portugal|czech republic|czechia|hungary|romania|croatia|greece|ireland|canada|australia|new zealand|singapore|japan|india|china|south korea|korea|brazil|argentina|turkey|ukraine|russia|south africa|egypt|nigeria|kenya|morocco|israel|uae|united arab emirates|qatar)\b/i,
  );
  const locationRaw = locationMatch?.[0] ?? '';
  const country = extractCountryCode(locationRaw) || '';
  const isAbroad = country !== 'IT' && country !== '';
  const isRemote = /\b(online|virtual|remote|worldwide|global|international)\b/i.test(fullText);

  // Expiry: deadline if known, otherwise 90 days from pubDate
  const pubDate = item.pubDate ?? now;
  const expiresAt = deadline ?? new Date(pubDate.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Organizer: try to extract from title pattern "X by/from/at Y"
  const orgMatch = item.title.match(
    /(?:by|from|at|–|-)\s+([A-Z][A-Za-z &]+?)(?:\s+\d{4}|$)/,
  );
  const organizer = orgMatch?.[1]?.trim() ?? null;

  // Cost: 0 if free/funded, null if unknown, positive if mentioned
  const costMatch = fullText.match(/(?:application\s+fee|registration\s+fee)[^\d]*(\d+)\s*(?:USD|\$|EUR|€)/i);
  const cost = funded || isRemote ? 0 : costMatch ? parseInt(costMatch[1], 10) : null;

  const description = item.description.slice(0, 2000);
  if (description.length < 20) return;

  records.push({
    id: sid,
    title: item.title.slice(0, 250),
    description,
    company: null,
    organizer,
    url: item.link,
    location: locationRaw || (isRemote ? 'Online' : null),
    isAbroad,
    isRemote,
    type,
    tags: item.categories.slice(0, 5).map(c => c.toLowerCase()),
    postedAt: pubDate,
    expiresAt,
    deadline: deadline ?? undefined,
    source: SOURCE_KEY,
    sourceId: sid,
    lastSyncedAt: now,
    country: country || null,
    cost,
    hasScholarship: funded,
    stipend,
    eligibleFields,
    verified: false,
  });
}
