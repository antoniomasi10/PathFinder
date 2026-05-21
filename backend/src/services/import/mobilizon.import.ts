/**
 * Mobilizon Italy — Community Event Import
 * Source: https://mobilizon.it GraphQL API (public, no auth for public events)
 *
 * Mobilizon is a federated open-source event platform (ActivityPub).
 * The Italian instance (mobilizon.it) hosts community-organized tech,
 * social, and innovation events.
 *
 * License: AGPL-3.0 — public API for public events, no API key required.
 * Note: aggregation code must remain open-source if distributed externally.
 * Ref: https://docs.mobilizon.org/5.%20Interoperability/3.graphql_api/
 *
 * Runs weekly Friday at 04:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, stripHtml, mapOpportunityType } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPHQL_ENDPOINT = 'https://mobilizon.it/api';
const SOURCE_KEY = 'mobilizon-it';
const LOOK_AHEAD_MONTHS = 6;

// ---------------------------------------------------------------------------
// GraphQL query + types
// ---------------------------------------------------------------------------

const SEARCH_EVENTS_QUERY = `
  query SearchEvents($beginsOn: DateTime!, $endsOn: DateTime!, $limit: Int!) {
    searchEvents(term: "", beginsOn: $beginsOn, endsOn: $endsOn, limit: $limit) {
      total
      elements {
        ... on Event {
          id
          title
          description
          url
          beginsOn
          endsOn
          onlineAddress
          physicalAddress {
            description
            locality
            region
            country
          }
          tags {
            title
            slug
          }
          organizerActor {
            name
            preferredUsername
          }
        }
      }
    }
  }
`;

interface MobilizonAddress {
  description?: string;
  locality?: string;
  region?: string;
  country?: string;
}

// Italian city/region names used to detect Italian events when country is null
const ITALIAN_LOCALITIES = new Set([
  'roma', 'milano', 'napoli', 'torino', 'palermo', 'genova', 'bologna',
  'firenze', 'bari', 'catania', 'venezia', 'verona', 'padova', 'trieste',
  'brescia', 'parma', 'modena', 'reggio emilia', 'reggio calabria', 'perugia',
  'livorno', 'ravenna', 'cagliari', 'foggia', 'rimini', 'salerno', 'ferrara',
  'latina', 'giugliano', 'monza', 'siracusa', 'bergamo', 'trento', 'lecce',
  'novara', 'piacenza', 'ancona', 'andria', 'arezzo', 'udine', 'pisa',
  'barletta', 'terni', 'vicenza', 'treviso', 'roncade', 'varese', 'como',
  'toscana', 'lombardia', 'veneto', 'emilia romagna', 'lazio', 'campania',
  'sicilia', 'puglia', 'calabria', 'piemonte', 'liguria', 'sardegna',
]);

interface MobilizonEvent {
  id: string;
  title: string;
  description?: string;
  url?: string;
  beginsOn: string;
  endsOn?: string;
  onlineAddress?: string;
  physicalAddress?: MobilizonAddress;
  tags?: Array<{ title: string; slug: string }>;
  organizerActor?: { name?: string; preferredUsername?: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(event: MobilizonEvent): string {
  // Use the Mobilizon UUID directly for stable dedup
  return `mob-${event.id}`;
}

function buildLocation(event: MobilizonEvent): string | null {
  if (event.onlineAddress) return 'Online';
  const addr = event.physicalAddress;
  if (!addr) return null;
  const parts = [addr.locality, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : addr.description ?? null;
}

function buildDescription(event: MobilizonEvent): string {
  const base = event.description ? stripHtml(event.description).slice(0, 1800) : '';
  const url = event.url || `https://mobilizon.it/events/${event.id}`;
  const suffix = `\n\nMore info: ${url}`;
  return (base + suffix).trim();
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importMobilizonOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[Mobilizon] Starting Italian community event import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const endsOn = new Date(now);
    endsOn.setMonth(endsOn.getMonth() + LOOK_AHEAD_MONTHS);

    const body = JSON.stringify({
      query: SEARCH_EVENTS_QUERY,
      variables: {
        beginsOn: now.toISOString(),
        endsOn: endsOn.toISOString(),
        limit: 200,
      },
    });

    const res = await fetchWithRetry(GRAPHQL_ENDPOINT, {
      timeoutMs: 20000,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      logTag: '[Mobilizon]',
    });

    if (!res.ok) throw new Error(`GraphQL request failed: HTTP ${res.status}`);

    const json = await res.json() as { data?: { searchEvents?: { total: number; elements: MobilizonEvent[] } }; errors?: any[] };

    if (json.errors?.length) {
      logger.warn(`[Mobilizon] GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    const elements = json.data?.searchEvents?.elements ?? [];
    logger.info(`[Mobilizon] Found ${elements.length} events (total: ${json.data?.searchEvents?.total ?? 0})`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const event of elements) {
      try {
        // Skip elements that didn't resolve to Event (inline fragment miss)
        if (!event.id) { skipped++; continue; }

        // Filter to Italian events: check address locality/country and tags
        const filterLocality = event.physicalAddress?.locality?.toLowerCase() ?? '';
        const filterCountry = event.physicalAddress?.country?.toLowerCase() ?? '';
        const tagTitles = (event.tags ?? []).map(t => t.title.toLowerCase());
        const isItalian = filterCountry === 'italy' || filterCountry === 'it' ||
          ITALIAN_LOCALITIES.has(filterLocality) ||
          tagTitles.some(t => ITALIAN_LOCALITIES.has(t) || t === 'italy' || t === 'italia');
        if (!isItalian) { skipped++; continue; }

        const sid = buildSourceId(event);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const title = event.title?.trim().slice(0, 250);
        if (!title || title.length < 3) { skipped++; continue; }

        const startDate = new Date(event.beginsOn);
        if (isNaN(startDate.getTime())) { skipped++; continue; }

        const endDate = event.endsOn ? new Date(event.endsOn) : null;
        const durationDays = endDate
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
          : 1;

        const isRemote = !!event.onlineAddress && !event.physicalAddress;
        const city = event.physicalAddress?.locality ?? null;
        const country = event.physicalAddress?.country
          ? event.physicalAddress.country.slice(0, 2).toUpperCase()
          : (isRemote ? null : 'IT');
        const isAbroad = !isRemote && !!country && country !== 'IT';

        const location = buildLocation(event);
        const description = buildDescription(event);
        if (description.length < 10) { skipped++; continue; }

        const eventUrl = event.url || `https://mobilizon.it/events/${event.id}`;
        const organizer = event.organizerActor?.name || event.organizerActor?.preferredUsername || null;
        const tags = ['mobilizon', 'community', 'italy', ...(event.tags?.map(t => t.slug) ?? [])];
        const type = mapOpportunityType(title);

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer,
          url: eventUrl,
          location,
          isAbroad,
          isRemote,
          expiresAt: endDate ?? startDate,
          startDate,
          endDate: endDate ?? null,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          city,
          country,
          cost: 0,
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
          organizer,
          url: eventUrl,
          location,
          isAbroad,
          isRemote,
          type: ['EVENT', 'HACKATHON', 'EXTRACURRICULAR', 'VOLUNTEERING'].includes(type) ? type : 'EVENT',
          tags,
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
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
          verified: false,
        });
      } catch (err) {
        logger.warn(`[Mobilizon] Error processing "${event.title?.slice(0, 50)}": ${err}`);
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
        metadata: { skipped, totalFetched: elements.length },
      },
    });

    logger.info(`[Mobilizon] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Mobilizon] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
