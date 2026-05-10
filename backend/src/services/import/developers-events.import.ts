/**
 * Developers.events — Italian Tech Conference Import
 * Source: https://developers.events/all-events.json (public JSON API)
 *
 * developers.events aggregates tech conferences globally, including 150+ Italian events.
 * This importer filters for upcoming events in Italy only.
 *
 * License: CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0)
 * → Redistribution with attribution permitted for NON-COMMERCIAL use only.
 * → Attribution: "Data from developers.events (CC BY-NC 4.0)"
 * → If PathFinder becomes commercial, this source must be renegotiated.
 * Ref: https://github.com/scraly/developers-conferences-agenda
 *
 * Runs weekly Tuesday at 04:30 via scheduler.ts.
 */
import { OpportunityFormat } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, mapOpportunityType, stripHtml } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = 'https://developers.events/all-events.json';
const SOURCE_KEY = 'developers-events';
const ATTRIBUTION = 'developers.events (CC BY-NC 4.0) – https://developers.events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevEvent {
  name: string;
  date: number[];  // Unix timestamps in ms [startMs, endMs?]
  hyperlink: string;
  location: string;
  city: string;
  country: string;
  misc?: string;
  cfp?: {
    link?: string;
    until?: string;
  };
  closedCaptions?: boolean;
  scholarship?: boolean;
  // API returns tags as either string[] or { key, value }[] depending on event
  tags?: Array<string | { key: string; value: string }>;
  status?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(event: DevEvent): string {
  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const yearStr = event.date[0] ? new Date(event.date[0]).getFullYear() : 'x';
  return `de-${slug}-${yearStr}`;
}

function normalizeTags(raw: DevEvent['tags']): string[] {
  if (!raw) return [];
  return raw.map(t => typeof t === 'string' ? t : t.value).filter(Boolean);
}

function buildDescription(event: DevEvent): string {
  const parts: string[] = [];
  if (event.location) parts.push(`Tech conference in ${event.location}.`);
  if (event.scholarship) parts.push('Diversity scholarships available.');
  if (event.closedCaptions) parts.push('Closed captions provided.');
  if (event.misc) parts.push(stripHtml(event.misc).trim());
  parts.push(`More info: ${event.hyperlink}`);
  parts.push(`Source: ${ATTRIBUTION}`);
  return parts.join(' ');
}

function resolveFormat(event: DevEvent): OpportunityFormat {
  const loc = event.location?.toLowerCase() ?? '';
  if (loc === 'online' || loc.includes('virtual') || loc.includes('remote')) return 'ONLINE';
  return 'IN_PERSON';
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importDevelopersEventsOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[DevelopersEvents] Starting Italian tech conference import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const res = await fetchWithRetry(API_URL, {
      timeoutMs: 20000,
      headers: { 'Accept': 'application/json' },
      logTag: '[DevelopersEvents]',
    });

    if (!res.ok) throw new Error(`API fetch failed: HTTP ${res.status}`);

    const allEvents: DevEvent[] = await res.json() as DevEvent[];
    logger.info(`[DevelopersEvents] Fetched ${allEvents.length} total events`);

    // Filter: Italian + upcoming
    const italianUpcoming = allEvents.filter(e => {
      const isItalian = e.country?.toLowerCase() === 'italy' ||
        e.location?.toLowerCase().includes('italy') ||
        e.location?.toLowerCase().includes('italia');
      const startMs = e.date?.[0];
      const isUpcoming = startMs && startMs > now.getTime();
      const notCanceled = e.status?.toLowerCase() !== 'canceled';
      return isItalian && isUpcoming && notCanceled;
    });

    logger.info(`[DevelopersEvents] Found ${italianUpcoming.length} upcoming Italian events`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const event of italianUpcoming) {
      try {
        const sid = buildSourceId(event);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        if (!event.hyperlink?.startsWith('http')) { skipped++; continue; }

        const startDate = new Date(event.date[0]);
        const endDate = event.date[1] ? new Date(event.date[1]) : null;
        const durationDays = endDate
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
          : 1;

        const format = resolveFormat(event);
        const isRemote = format === 'ONLINE';
        const country = 'IT';
        const isAbroad = false;
        const city = isRemote ? null : (event.city || null);
        const location = isRemote ? 'Online' : event.location;

        const title = event.name.slice(0, 250);
        if (title.length < 3) { skipped++; continue; }

        const description = buildDescription(event);
        const type = mapOpportunityType(title);

        const cfpDeadline = event.cfp?.until ? new Date(event.cfp.until) : null;

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: null,
          url: event.hyperlink,
          location,
          isAbroad,
          isRemote,
          expiresAt: endDate ?? startDate,
          startDate,
          endDate: endDate ?? null,
          durationDays,
          format,
          city,
          country,
          cost: null,
          hasScholarship: event.scholarship ?? false,
          eligibleFields: [],
          verified: false,
          deadline: cfpDeadline ?? undefined,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        const tags = ['italy', 'tech', 'conference', ...normalizeTags(event.tags)];
        if (event.scholarship) tags.push('scholarship');
        if (event.closedCaptions) tags.push('accessibility');

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: null,
          url: event.hyperlink,
          location,
          isAbroad,
          isRemote,
          type: ['CONFERENCE', 'EVENT', 'HACKATHON', 'COMPETITION'].includes(type) ? type : 'CONFERENCE',
          tags,
          postedAt: startDate,
          expiresAt: endDate ?? startDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate: endDate ?? null,
          durationDays,
          format,
          city,
          country,
          cost: null,
          hasScholarship: event.scholarship ?? false,
          eligibleFields: [],
          verified: false,
          deadline: cfpDeadline ?? undefined,
        });
      } catch (err) {
        logger.warn(`[DevelopersEvents] Error processing "${event.name?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);

    const seenIds = records.map(r => r.id);
    await markStaleOpportunities(SOURCE_KEY, seenIds, { minSeenForStale: 5 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: records.length,
        finishedAt: new Date(),
        metadata: { skipped, totalFetched: allEvents.length, italianUpcoming: italianUpcoming.length },
      },
    });

    logger.info(`[DevelopersEvents] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[DevelopersEvents] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
