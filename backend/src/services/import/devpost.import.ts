/**
 * Devpost Hackathon Import — DISABLED
 *
 * ⚠️  LEGAL HOLD: Devpost ToS explicitly prohibits automated access:
 * "users must not use automated software, devices, scripts, robots, or other
 * means or processes to access, scrape, crawl or spider the Site."
 * The /api/hackathons endpoint is undocumented and not sanctioned for 3rd-party use.
 *
 * Status: importer built but disabled in scheduler.ts and import.routes.ts.
 * To re-enable: obtain written permission from Devpost (support@devpost.com)
 * or wait for an official partnership/API program.
 *
 * The 92 records already in DB (source='devpost') will be expired by the
 * weekly cleanup job once their expiresAt passes. No new data will be added.
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

const API_BASE = 'https://devpost.com/api/hackathons';
const MAX_PAGES = 5;
const PAGE_SIZE = 24;
const PAGE_DELAY_MS = 1500;
const SOURCE_KEY = 'devpost';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevpostHackathon {
  id: number;
  title: string;
  url: string;
  displayed_location: { icon: string; location: string };
  open_state: 'open' | 'upcoming' | 'closed';
  submission_period_dates: string; // e.g. "Feb 26 - Apr 29, 2026"
  themes: { id: number; name: string }[];
  prize_amount: string;           // HTML string with span tag
  organization_name: string;
  invite_only: boolean;
  registrations_count: number;
  winners_announced: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(id: number): string {
  return `dp-${id}`;
}

/**
 * Parses "Feb 26 - Apr 29, 2026" into start/end Date objects.
 * Returns null if parsing fails.
 */
function parseDateRange(raw: string): { start: Date; end: Date } | null {
  // Pattern: "Month Day - Month Day, Year" or "Month Day, Year - Month Day, Year"
  const m = raw.match(
    /([A-Z][a-z]+\s+\d{1,2})(?:,\s*(\d{4}))?\s*[-–]\s*([A-Z][a-z]+\s+\d{1,2}),\s*(\d{4})/,
  );
  if (!m) return null;

  const year = m[4];
  const startStr = m[2] ? `${m[1]}, ${m[2]}` : `${m[1]}, ${year}`;
  const endStr = `${m[3]}, ${year}`;

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

/**
 * Extracts prize amount in USD from the HTML-contaminated prize_amount string.
 * e.g. "$<span data-currency-value>10,000</span>" → 10000
 */
function parsePrizeAmount(raw: string): number | null {
  const m = raw.replace(/<[^>]+>/g, '').match(/[\d,]+/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

/**
 * Maps Devpost theme names to FieldOfStudy values.
 */
const THEME_FIELD_MAP: Record<string, FieldOfStudy> = {
  'Machine Learning/AI': 'COMPUTER_SCIENCE',
  'Artificial Intelligence': 'COMPUTER_SCIENCE',
  'Web': 'COMPUTER_SCIENCE',
  'Mobile': 'COMPUTER_SCIENCE',
  'Cybersecurity': 'COMPUTER_SCIENCE',
  'Blockchain': 'COMPUTER_SCIENCE',
  'Health': 'MEDICINE',
  'Healthcare': 'MEDICINE',
  'Biotech': 'LIFE_SCIENCES',
  'Environment': 'LIFE_SCIENCES',
  'Education': 'EDUCATION',
  'FinTech': 'ECONOMICS',
  'Finance': 'ECONOMICS',
  'Social Good': 'HUMANITIES',
  'Productivity': 'BUSINESS',
  'Enterprise': 'BUSINESS',
  'Design': 'DESIGN',
  'Open Source': 'COMPUTER_SCIENCE',
};

function resolveFields(themes: { name: string }[]): FieldOfStudy[] {
  const fields = new Set<FieldOfStudy>();
  for (const t of themes) {
    const mapped = THEME_FIELD_MAP[t.name];
    if (mapped) fields.add(mapped);
    else {
      const normalized = normalizeFieldToEnum(t.name);
      if (normalized !== 'ANY') fields.add(normalized);
    }
  }
  return Array.from(fields);
}

function buildDescription(h: DevpostHackathon, prize: number | null): string {
  const parts: string[] = [];
  const isOnline = h.displayed_location.icon === 'globe';

  if (isOnline) parts.push('Online hackathon — open to participants worldwide.');
  else parts.push(`Hackathon in ${h.displayed_location.location}.`);

  if (prize) parts.push(`Prize pool: $${prize.toLocaleString()}.`);
  if (h.registrations_count > 0) parts.push(`${h.registrations_count.toLocaleString()} participants registered.`);
  if (h.themes.length > 0) parts.push(`Themes: ${h.themes.map(t => t.name).join(', ')}.`);
  parts.push(`Register at: ${h.url}`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importDevpostOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[Devpost] Starting hackathon import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const allHackathons: DevpostHackathon[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      if (page > 1) await new Promise(r => setTimeout(r, PAGE_DELAY_MS));

      const url = `${API_BASE}?status[]=upcoming&status[]=open&order_by=deadline&per_page=${PAGE_SIZE}&page=${page}`;
      const res = await fetchWithRetry(url, {
        timeoutMs: 15000,
        headers: { 'Accept': 'application/json' },
        logTag: '[Devpost]',
      });

      if (!res.ok) {
        logger.warn(`[Devpost] Page ${page} returned HTTP ${res.status}, stopping`);
        break;
      }

      const data = await res.json() as { hackathons?: DevpostHackathon[] };
      const batch: DevpostHackathon[] = data.hackathons ?? [];
      if (batch.length === 0) break;

      allHackathons.push(...batch);
      logger.info(`[Devpost] Page ${page}: ${batch.length} hackathons (total so far: ${allHackathons.length})`);

      if (batch.length < PAGE_SIZE) break; // last page
    }

    logger.info(`[Devpost] Total fetched: ${allHackathons.length}`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const h of allHackathons) {
      try {
        // Skip invite-only events
        if (h.invite_only) { skipped++; continue; }

        const sid = buildSourceId(h.id);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const dates = parseDateRange(h.submission_period_dates);
        const startDate = dates?.start ?? null;
        const endDate = dates?.end ?? null;
        const durationDays = (startDate && endDate)
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        const isOnline = h.displayed_location.icon === 'globe';
        const isRemote = isOnline;
        const isAbroad = !isOnline; // in-person hackathons are almost always abroad for IT students
        const prize = parsePrizeAmount(h.prize_amount);
        const eligibleFields = resolveFields(h.themes);
        const tags = ['hackathon', ...h.themes.map(t => t.name.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-'))].slice(0, 6);

        const title = h.title.slice(0, 250);
        const description = buildDescription(h, prize);

        const v = validateOpportunity({
          title,
          description,
          company: h.organization_name || null,
          organizer: h.organization_name || null,
          url: h.url,
          location: isOnline ? 'Online' : h.displayed_location.location,
          isAbroad,
          isRemote,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format: isOnline ? 'ONLINE' : 'IN_PERSON',
          country: null,
          cost: 0,
          hasScholarship: false,
          stipend: prize ?? undefined,
          eligibleFields,
          verified: false,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: h.organization_name || null,
          organizer: h.organization_name || null,
          url: h.url,
          location: isOnline ? 'Online' : h.displayed_location.location,
          isAbroad,
          isRemote,
          type: 'HACKATHON',
          tags,
          postedAt: startDate ?? now,
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format: isOnline ? 'ONLINE' : 'IN_PERSON',
          country: null,
          cost: 0,
          hasScholarship: false,
          stipend: prize ?? undefined,
          eligibleFields,
          verified: false,
        });
      } catch (err) {
        logger.warn(`[Devpost] Error processing "${h.title?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);

    const seenIds = records.map(r => r.id);
    await markStaleOpportunities(SOURCE_KEY, seenIds, { minSeenForStale: 10 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: records.length,
        finishedAt: new Date(),
        metadata: { skipped, totalFetched: allHackathons.length },
      },
    });

    logger.info(`[Devpost] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Devpost] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
