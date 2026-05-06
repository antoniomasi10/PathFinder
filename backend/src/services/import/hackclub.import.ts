/**
 * HackClub Hackathon Import
 * Source: https://hackathons.hackclub.com/api/events/upcoming (official public API)
 *
 * Hack Club provides a sanctioned public API (MIT license) for their hackathon
 * directory. Attribution required: "Hack Club Hackathons – hackathons.hackclub.com"
 * included in each record's tags and organizer field.
 *
 * Legal basis: official API, MIT license, explicit attribution provided.
 * Ref: https://hackathons.hackclub.com/data/
 *
 * Runs weekly Monday at 04:30 via scheduler.ts.
 */
import { OpportunityFormat } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Official public API — documented at https://hackathons.hackclub.com/data/
const API_URL = 'https://hackathons.hackclub.com/api/events/upcoming';
const SOURCE_KEY = 'hackclub';
const ATTRIBUTION = 'Hack Club Hackathons – hackathons.hackclub.com';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HackClubEvent {
  id: string;
  name: string;
  website: string;
  start: string;
  end: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  virtual: boolean;
  hybrid: boolean;
  mlhAssociated: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(id: string): string {
  return `hc-${id}`;
}

function resolveFormat(event: HackClubEvent): OpportunityFormat {
  if (event.hybrid) return 'HYBRID';
  if (event.virtual) return 'ONLINE';
  return 'IN_PERSON';
}

function buildLocation(event: HackClubEvent): string | null {
  if (event.virtual) return 'Online';
  const parts = [event.city, event.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function buildDescription(event: HackClubEvent): string {
  const parts: string[] = [];
  if (event.mlhAssociated) parts.push('MLH-affiliated hackathon.');
  if (event.virtual) parts.push('Fully online event — open to participants worldwide.');
  else if (event.hybrid) parts.push('Hybrid event — attend in person or online.');
  else {
    const loc = buildLocation(event);
    parts.push(`In-person hackathon${loc ? ` in ${loc}` : ''}.`);
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
  parts.push(`Duration: ${durationDays} day${durationDays > 1 ? 's' : ''}.`);
  parts.push(`More info and registration: ${event.website}`);
  return parts.join(' ');
}


// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importHackClubOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[HackClub] Starting hackathon import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    // Official public API — https://hackathons.hackclub.com/data/
    const res = await fetchWithRetry(API_URL, {
      timeoutMs: 20000,
      headers: { 'Accept': 'application/json' },
      logTag: '[HackClub]',
    });

    if (!res.ok) throw new Error(`API fetch failed: HTTP ${res.status}`);

    const upcoming: HackClubEvent[] = await res.json() as HackClubEvent[];
    logger.info(`[HackClub] Found ${upcoming.length} upcoming events from official API`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const event of upcoming) {
      try {
        const sid = buildSourceId(event.id);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { skipped++; continue; }

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
        const format = resolveFormat(event);
        const country = event.countryCode?.toUpperCase().slice(0, 2) ?? null;
        const isAbroad = !!country && country !== 'IT';
        const isRemote = format === 'ONLINE' || format === 'HYBRID';
        const location = buildLocation(event);

        const title = event.name.slice(0, 250);
        const description = buildDescription(event);

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: 'Hack Club',
          url: event.website,
          location,
          isAbroad,
          isRemote,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format,
          city: event.city ?? null,
          country,
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
          verified: event.mlhAssociated,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        const tags = ['hackathon', 'hack-club'];
        if (event.mlhAssociated) tags.push('mlh');
        if (isRemote) tags.push('online');
        if (event.country) tags.push(event.country.toLowerCase());

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: 'Hack Club',
          url: event.website,
          location,
          isAbroad,
          isRemote,
          type: 'HACKATHON',
          tags,
          postedAt: new Date(event.start),
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format,
          city: event.city ?? null,
          country,
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
          verified: event.mlhAssociated,
        });
      } catch (err) {
        logger.warn(`[HackClub] Error processing "${event.name?.slice(0, 50)}": ${err}`);
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
        metadata: { skipped, totalFetched: upcoming.length },
      },
    });

    logger.info(`[HackClub] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[HackClub] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
