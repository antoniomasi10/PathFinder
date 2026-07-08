/**
 * Direct-fetch batch runner for structured HarvestTarget feeds (jsonld/ics/rss).
 *
 * These feedKinds bypass the ScrapeJob queue entirely — 0 LLM, a single cheap
 * fetch per target, no need for the per-domain backoff/rate-limit machinery
 * the queue exists for (same reasoning as why parseRSSFeed-based importers
 * like hackclub.import.ts never touch the queue). Runs as its own weekly
 * scheduler cron, separate from enqueueScrapeJobs/runScrapeWorker (html-* only).
 */
import { HarvestTarget, OpportunityType } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { validateOpportunity } from '../validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from '../batch';
import { extractCountryCode, fetchWithRetry, stripHtml, parseRSSFeed } from '../utils';
import { processTargetCompliance } from './harvest-compliance';
import { extractJsonLdEvents, JsonLdEvent } from './jsonld-parser';
import { parseIcs, IcsEvent } from './ics-parser';

const STRUCTURED_KINDS = ['jsonld', 'ics', 'rss'] as const;

function parseIcsDate(value: string | undefined): Date | null {
  if (!value) return null;
  // "20260110T090000Z" or "20260110" (date-only, all-day event)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

function sourceIdFor(target: HarvestTarget, title: string, url: string): string {
  return `harvest-${target.id}-${Buffer.from(title + url).toString('base64').slice(0, 20)}`;
}

function resolveType(target: HarvestTarget): OpportunityType {
  return target.categoryHint ?? 'EVENT';
}

function buildRecordFromCommonFields(
  target: HarvestTarget,
  now: Date,
  fields: {
    title: string; url: string; description: string;
    startDate?: Date | null; endDate?: Date | null; location?: string | null;
  },
): OpportunityRecord | null {
  const location = fields.location || null;
  const countryCode = (location && extractCountryCode(location)) || target.country || null;
  const isAbroad = !!countryCode && countryCode !== 'IT';
  const sourceId = sourceIdFor(target, fields.title, fields.url);

  const validated = validateOpportunity({
    title: fields.title.slice(0, 250),
    description: stripHtml(fields.description).slice(0, 10000) || `${fields.title} — ${target.name}.`,
    company: null,
    organizer: target.name,
    url: fields.url,
    location,
    isAbroad,
    isRemote: false,
    expiresAt: fields.endDate ?? null,
    startDate: fields.startDate ?? null,
    endDate: fields.endDate ?? null,
    country: countryCode,
    cost: null,
    hasScholarship: false,
    eligibleFields: [],
    verified: false,
  }, 'HarvestTarget');

  if (!validated) return null;

  return {
    id: sourceId,
    title: validated.title,
    description: validated.description,
    company: null,
    organizer: target.name,
    url: validated.url ?? null,
    location: validated.location || null,
    isAbroad: validated.isAbroad,
    isRemote: false,
    type: resolveType(target),
    tags: [target.sourceLabel],
    postedAt: now,
    expiresAt: validated.expiresAt ?? null,
    source: 'HarvestTarget',
    sourceId,
    lastSyncedAt: now,
    startDate: validated.startDate ?? null,
    endDate: validated.endDate ?? null,
    country: countryCode,
    hasScholarship: false,
    eligibleFields: [],
    verified: false,
  };
}

function mapJsonLdEvent(target: HarvestTarget, now: Date, event: JsonLdEvent): OpportunityRecord | null {
  return buildRecordFromCommonFields(target, now, {
    title: event.name,
    url: event.url || target.url,
    description: event.description || event.name,
    startDate: event.startDate ? new Date(event.startDate) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
    location: event.locationName,
  });
}

function mapIcsEvent(target: HarvestTarget, now: Date, event: IcsEvent): OpportunityRecord | null {
  return buildRecordFromCommonFields(target, now, {
    title: event.summary,
    url: event.url || target.url,
    description: event.description || event.summary,
    startDate: parseIcsDate(event.dtstart),
    endDate: parseIcsDate(event.dtend),
    location: event.location,
  });
}

async function runOneTarget(target: HarvestTarget, now: Date): Promise<{ imported: number; skipped: number }> {
  const allowed = await processTargetCompliance(target, now);
  if (!allowed) {
    await prisma.harvestTarget.update({ where: { id: target.id }, data: { lastScrapeStatus: 'blocked', lastSyncedAt: now } });
    return { imported: 0, skipped: 0 };
  }

  const res = await fetchWithRetry(target.url, { timeoutMs: 20000, logTag: `[HarvestFeed] ${target.name}` });
  if (!res.ok) {
    await prisma.harvestTarget.update({ where: { id: target.id }, data: { lastScrapeStatus: 'error', lastSyncedAt: now } });
    return { imported: 0, skipped: 0 };
  }
  const body = await res.text();

  const records: OpportunityRecord[] = [];
  let skipped = 0;

  if (target.feedKind === 'jsonld') {
    for (const event of extractJsonLdEvents(body)) {
      const record = mapJsonLdEvent(target, now, event);
      if (record) records.push(record); else skipped++;
    }
  } else if (target.feedKind === 'ics') {
    for (const event of parseIcs(body)) {
      const record = mapIcsEvent(target, now, event);
      if (record) records.push(record); else skipped++;
    }
  } else if (target.feedKind === 'rss') {
    for (const item of parseRSSFeed(body)) {
      const record = buildRecordFromCommonFields(target, now, {
        title: item.title, url: item.link, description: item.description || item.title,
      });
      if (record) records.push(record); else skipped++;
    }
  }

  if (records.length > 0) {
    await batchUpsertOpportunities(records);
    await markStaleOpportunities('HarvestTarget', records.map(r => r.id), {
      scopeOrganizers: [target.name],
      minSeenForStale: 1,
    });
  }

  await prisma.harvestTarget.update({ where: { id: target.id }, data: { lastScrapeStatus: 'ok', lastSyncedAt: now } });
  logger.info(`[HarvestFeed] ${target.name} (${target.feedKind}): ${records.length} imported, ${skipped} skipped`);
  return { imported: records.length, skipped };
}

/** Runs every active structured (jsonld/ics/rss) HarvestTarget. */
export async function runHarvestFeeds(): Promise<{ imported: number; skipped: number; targets: number }> {
  logger.info('[HarvestFeed] Starting structured feed run...');
  const now = new Date();

  const targets = await prisma.harvestTarget.findMany({
    where: { isActive: true, feedKind: { in: [...STRUCTURED_KINDS] } },
  });

  let imported = 0;
  let skipped = 0;

  for (const target of targets) {
    try {
      const result = await runOneTarget(target, now);
      imported += result.imported;
      skipped += result.skipped;
    } catch (err) {
      logger.warn(`[HarvestFeed] ${target.name} failed: ${err}`);
    }
  }

  logger.info(`[HarvestFeed] Done: ${targets.length} targets, ${imported} imported, ${skipped} skipped`);
  return { imported, skipped, targets: targets.length };
}
