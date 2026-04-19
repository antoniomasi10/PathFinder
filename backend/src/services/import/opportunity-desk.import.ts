/**
 * Opportunity Desk — RSS Feed Import
 * Source: https://opportunitydesk.org/feed/
 *
 * Opportunity Desk aggregates global opportunities: fellowships, competitions,
 * research grants, scholarships, volunteering, conferences, and internships.
 * The RSS feed is public (WordPress, no auth). Content is published under
 * standard copyright with attribution expected.
 *
 * Attribution: "via Opportunity Desk (opportunitydesk.org)" — included in source field.
 *
 * Runs every 2 days (Mon/Wed/Fri) at 03:00 via scheduler.ts.
 */
import { FieldOfStudy, OpportunityType } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, OpportunityRecord } from './batch';
import {
  stripHtml,
  extractCountryCode,
  mapOpportunityType,
  normalizeFieldToEnum,
  fetchWithRetry,
  parseRSSFeed,
  type RSSItem,
} from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FEED_URL = 'https://opportunitydesk.org/feed/?posts_per_page=50';
const FETCH_DELAY_MS = 1000;
const SOURCE_KEY = 'opportunity-desk';

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
    const records: OpportunityRecord[] = [];

    // Fetch RSS feed
    const res = await fetchWithRetry(FEED_URL, {
      timeoutMs: 20000,
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
      logTag: '[OpportunityDesk]',
    });

    if (!res.ok) {
      throw new Error(`RSS fetch failed: HTTP ${res.status}`);
    }

    const xml = await res.text();
    const items = parseRSSFeed(xml);
    logger.info(`[OpportunityDesk] Parsed ${items.length} RSS items`);

    // Dedup: skip IDs already processed in this batch
    const batchIds = new Set<string>();

    for (const item of items) {
      try {
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
        processItem(item, now, records, batchIds);
      } catch (err) {
        logger.warn(`[OpportunityDesk] Item processing error for "${item.title?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

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

    await batchUpsertOpportunities(validRecords);

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: validRecords.length,
        finishedAt: new Date(),
        metadata: { skipped, totalParsed: items.length },
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
): void {
  const sid = buildSourceId(item.link);
  if (batchIds.has(sid)) return;
  batchIds.add(sid);

  const fullText = `${item.title} ${item.description}`;

  // Determine type: categories first, then title-based fallback
  const type: OpportunityType =
    mapTypeFromCategories(item.categories) ??
    mapOpportunityType(item.title);

  // Extract metadata
  const deadline = extractDeadline(fullText);
  const funded = detectFunded(fullText);
  const stipend = extractStipend(fullText);
  const eligibleFields = extractEligibleFields(fullText);

  // Location / country
  const locationMatch = fullText.match(
    /\b(italy|italia|germany|france|spain|uk|united kingdom|usa|united states|netherlands|austria|switzerland|sweden|norway|belgium|poland|canada|australia|singapore|japan)\b/i,
  );
  const locationRaw = locationMatch?.[0] ?? '';
  const country = extractCountryCode(locationRaw) || '';
  const isAbroad = country !== 'IT' && country !== '';
  const isRemote = /\b(online|virtual|remote|worldwide|global)\b/i.test(fullText);

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
