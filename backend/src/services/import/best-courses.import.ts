/**
 * BEST Courses Import
 * Source: https://www.best.eu.org/courses/list.jsp
 *
 * BEST (Board of European Students of Technology) organises week-long academic
 * courses for engineering/technology students at European universities. Courses
 * are hosted by local BEST groups (100+ European universities), taught in
 * English, and open to all European students. Fees are typically €60–€120
 * covering accommodation and meals.
 *
 * Mapped type: EXCHANGE (week abroad at a foreign university, organised by
 * student association — closer to an academic exchange than a course).
 *
 * ⚠️  LEGAL STATUS: YELLOW — BEST.eu.org ToS not publicly accessible (403 on legal pages).
 * Temporarily disabled in scheduler.ts pending explicit permission from BEST.
 * Contact: info@best.eu.org — ask for data usage rights for a non-commercial student platform.
 *
 * Runs monthly on the 1st at 03:30 via scheduler.ts (currently disabled).
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, normalizeFieldToEnum } from './utils';
import { FieldOfStudy } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LIST_URL = 'https://www.best.eu.org/courses/list.jsp';
const BASE_URL = 'https://www.best.eu.org';
const SOURCE_KEY = 'best-courses';

// BEST courses are engineering-oriented
const DEFAULT_FIELDS: FieldOfStudy[] = ['ENGINEERING', 'COMPUTER_SCIENCE', 'MATHEMATICS'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(activityId: string): string {
  return `best-${activityId}`;
}

/**
 * Parses country from "City, Country" location strings.
 * Returns ISO-2 code or null.
 */
const COUNTRY_MAP: Record<string, string> = {
  'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT',
  'poland': 'PL', 'turkey': 'TR', 'belgium': 'BE', 'netherlands': 'NL',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
  'portugal': 'PT', 'austria': 'AT', 'switzerland': 'CH', 'czech': 'CZ',
  'slovakia': 'SK', 'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG',
  'croatia': 'HR', 'serbia': 'RS', 'greece': 'GR', 'ukraine': 'UA',
  'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT', 'slovenia': 'SI',
  'uk': 'GB', 'united kingdom': 'GB', 'ireland': 'IE',
};

function resolveCountry(location: string): string | null {
  const lower = location.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

/**
 * Parses "1 - 8 September 2026" or "6 - 13 September 2026" into {start, end}.
 */
function parseBestDates(raw: string): { start: Date; end: Date } | null {
  const m = raw.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const [, d1, d2, month, year] = m;
  const start = new Date(`${d1} ${month} ${year}`);
  const end = new Date(`${d2} ${month} ${year}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

/**
 * Strips HTML entities and tags from a string.
 */
function cleanText(raw: string): string {
  return raw
    .replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '').trim();
}

/**
 * Infers FieldOfStudy from the course title keywords.
 */
function inferFields(title: string): FieldOfStudy[] {
  const t = title.toLowerCase();
  const fields = new Set<FieldOfStudy>(DEFAULT_FIELDS);

  if (/robot|mechatron|automat/i.test(t)) fields.add('ENGINEERING');
  if (/ai|machine\s*learning|data|analytics|neural|deep\s*learn/i.test(t)) fields.add('COMPUTER_SCIENCE');
  if (/cyber|security|crypto|network/i.test(t)) fields.add('COMPUTER_SCIENCE');
  if (/bio|health|medic/i.test(t)) { fields.add('LIFE_SCIENCES'); }
  if (/energy|environment|sustainable|climate/i.test(t)) fields.add('PHYSICAL_SCIENCES');
  if (/business|management|organiz/i.test(t)) fields.add('BUSINESS');
  if (/design/i.test(t)) fields.add('DESIGN');

  return Array.from(fields);
}

/**
 * Parses the cost string "60.0€" → 60.
 */
function parseCost(raw: string): number | null {
  const m = cleanText(raw).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]));
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

interface BestCourseRow {
  title: string;
  location: string;
  dates: string;
  type: string;
  cost: string;
  activityId: string;
}

function parseCoursesFromHtml(html: string): BestCourseRow[] {
  const courses: BestCourseRow[] = [];

  // Each row: <tr>...<td>...</td>...</tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract the activity link (sourceId)
    const linkMatch = rowHtml.match(/href="\/event\/details\.jsp\?activity=([^"]+)"/);
    if (!linkMatch) continue;
    const activityId = linkMatch[1];

    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }

    if (cells.length < 5 || !cells[0]) continue;

    courses.push({
      title: cells[0],
      location: cells[1] ?? '',
      dates: cells[2] ?? '',
      type: cells[3]?.replace(/\s+/g, ' ').trim() ?? '',
      cost: cells[5] ?? '',
      activityId,
    });
  }

  return courses;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importBestCoursesOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[BestCourses] Starting import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const res = await fetchWithRetry(LIST_URL, {
      timeoutMs: 20000,
      headers: { 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      logTag: '[BestCourses]',
    });

    if (!res.ok) throw new Error(`Page fetch failed: HTTP ${res.status}`);

    const html = await res.text();
    const courseRows = parseCoursesFromHtml(html);
    logger.info(`[BestCourses] Parsed ${courseRows.length} courses`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const row of courseRows) {
      try {
        const sid = buildSourceId(row.activityId);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const dates = parseBestDates(row.dates);
        const startDate = dates?.start ?? null;
        const endDate = dates?.end ?? null;

        // Skip past events
        if (endDate && endDate < now) { skipped++; continue; }

        const durationMs = (startDate && endDate) ? endDate.getTime() - startDate.getTime() : null;
        const durationDays = durationMs ? Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24))) : 7;

        const country = resolveCountry(row.location);
        const isAbroad = country !== 'IT';
        const cityPart = row.location.split(',')[0].trim();
        const cost = parseCost(row.cost);
        const eligibleFields = inferFields(row.title);

        const title = row.title.slice(0, 250);
        const description = [
          `BEST Course at a European university. Location: ${row.location}.`,
          `Dates: ${row.dates}.`,
          `Open to all European engineering/technology students.`,
          `Course fee: ${cost ? `€${cost}` : 'varies'} (typically covers accommodation and meals).`,
          `Register at: ${BASE_URL}/event/details.jsp?activity=${row.activityId}`,
        ].join(' ');

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: 'BEST',
          url: `${BASE_URL}/event/details.jsp?activity=${row.activityId}`,
          location: row.location,
          isAbroad,
          isRemote: false,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format: 'IN_PERSON',
          city: cityPart || null,
          country,
          cost,
          hasScholarship: false,
          eligibleFields,
          verified: false,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: 'BEST',
          url: `${BASE_URL}/event/details.jsp?activity=${row.activityId}`,
          location: row.location,
          isAbroad,
          isRemote: false,
          type: 'EXCHANGE',
          tags: ['best', 'exchange', 'engineering', 'europe', 'university-week'],
          postedAt: now,
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format: 'IN_PERSON',
          city: cityPart || null,
          country,
          cost,
          hasScholarship: false,
          eligibleFields,
          verified: false,
        });
      } catch (err) {
        logger.warn(`[BestCourses] Error processing "${row.title?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);

    const seenIds = records.map(r => r.id);
    await markStaleOpportunities(SOURCE_KEY, seenIds, { minSeenForStale: 3 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: records.length,
        finishedAt: new Date(),
        metadata: { skipped, totalParsed: courseRows.length },
      },
    });

    logger.info(`[BestCourses] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[BestCourses] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
