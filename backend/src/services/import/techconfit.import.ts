/**
 * TechConfit Italian Tech Conference Import
 * Source: https://techconfit.github.io/ (ICS calendar)
 *
 * TechConfit is a community-curated list of Italian tech conferences.
 * License: CC0 (Public Domain) — no attribution required, unrestricted use.
 * Data: rendered ICS at https://techconfit.github.io/conferences.ics
 *
 * Legal basis: CC0 Public Domain, no ToS restriction on automated reads.
 * Ref: https://github.com/techconfit/techconfit.github.io
 *
 * Runs weekly Thursday at 04:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, extractCountryCode } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ICS_URL = 'https://techconfit.github.io/conferences.ics';
const SOURCE_KEY = 'techconfit';

// ---------------------------------------------------------------------------
// ICS parsing
// ---------------------------------------------------------------------------

interface ICSEvent {
  uid: string;
  summary: string;
  url: string;
  location: string | null;
  dtstart: string;
  dtend: string | null;
  description: string | null;
}

function parseICS(icsText: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const blocks = icsText.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string): string | null => {
      const m = block.match(new RegExp(`${key}[^:]*:([^\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : null;
    };
    const uid = get('UID');
    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    if (!uid || !summary || !dtstart) continue;
    events.push({
      uid,
      summary,
      url: get('URL') ?? '',
      location: get('LOCATION'),
      dtstart,
      dtend: get('DTEND'),
      description: get('DESCRIPTION'),
    });
  }
  return events;
}

function parseICSDate(icsDate: string): Date | null {
  // Format: YYYYMMDD (VALUE=DATE) or YYYYMMDDTHHmmssZ (datetime)
  const clean = icsDate.replace(/[TZ]/g, '').slice(0, 8);
  if (clean.length !== 8) return null;
  const y = parseInt(clean.slice(0, 4));
  const m = parseInt(clean.slice(4, 6)) - 1;
  const d = parseInt(clean.slice(6, 8));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

function extractCity(location: string | null): string | null {
  if (!location) return null;
  // Format: "City, Country" or "City (Country)" or just "City"
  const m = location.match(/^([^,\(]+)/);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importTechConfitOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[TechConfit] Starting Italian tech conference import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const res = await fetchWithRetry(ICS_URL, {
      timeoutMs: 15000,
      headers: { 'Accept': 'text/calendar, text/plain, */*' },
      logTag: '[TechConfit]',
    });

    if (!res.ok) throw new Error(`ICS fetch failed: HTTP ${res.status}`);

    const icsText = await res.text();
    const allEvents = parseICS(icsText);

    // Only import upcoming events
    const upcomingEvents = allEvents.filter(e => {
      const start = parseICSDate(e.dtstart);
      return start && start >= now;
    });

    logger.info(`[TechConfit] Found ${allEvents.length} total, ${upcomingEvents.length} upcoming`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const event of upcomingEvents) {
      try {
        const sid = `tc-${event.uid.split('/').pop()?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() ?? event.uid.slice(-40)}`;
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const startDate = parseICSDate(event.dtstart);
        if (!startDate) { skipped++; continue; }

        const endDate = event.dtend ? parseICSDate(event.dtend) : null;
        const durationDays = endDate
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
          : 1;

        const location = event.location;
        const city = extractCity(location);
        const country = location ? (extractCountryCode(location) || 'IT') : 'IT';
        const isRemote = location?.toLowerCase() === 'online';
        const isAbroad = !isRemote && country !== 'IT';

        // Strip location parenthetical from summary e.g. "AngularDay (Verona, Italy)" → "AngularDay"
        const title = event.summary.replace(/\s*\([^)]+\)\s*$/, '').trim().slice(0, 250);
        if (title.length < 3) { skipped++; continue; }

        const url = event.url || event.description || '';
        if (!url.startsWith('http')) { skipped++; continue; }

        const description = `Italian tech conference: ${title}.${location ? ` Taking place in ${location}.` : ''} Visit the event website for tickets and programme details.`;

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: null,
          url,
          location: location ?? null,
          isAbroad,
          isRemote,
          expiresAt: endDate ?? startDate,
          startDate,
          endDate: endDate ?? null,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          city,
          country,
          cost: null,
          hasScholarship: false,
          eligibleFields: [],
          verified: false,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: null,
          url,
          location: location ?? null,
          isAbroad,
          isRemote,
          type: 'EVENT',
          tags: ['techconfit', 'conference', 'italy', 'tech'],
          postedAt: startDate,
          expiresAt: endDate ?? startDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate: endDate ?? null,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          city,
          country,
          cost: null,
          hasScholarship: false,
          eligibleFields: [],
          verified: false,
        });
      } catch (err) {
        logger.warn(`[TechConfit] Error processing "${event.summary?.slice(0, 50)}": ${err}`);
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
        metadata: { skipped, totalFetched: allEvents.length, upcomingFetched: upcomingEvents.length },
      },
    });

    logger.info(`[TechConfit] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[TechConfit] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
