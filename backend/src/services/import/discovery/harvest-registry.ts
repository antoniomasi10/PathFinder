/**
 * DB-backed HarvestTarget registry — twin of ats/registry.ts's
 * registerAtsBoard/registerScrapeTarget, for organizer opportunity pages
 * instead of company careers pages.
 */
import { OpportunityType } from '@prisma/client';
import prisma from '../../../lib/prisma';

export interface RegisterHarvestTargetInput {
  name: string;
  url: string; // unique key — the URL to fetch (page for jsonld/html-*, feed URL for ics/rss)
  sourceLabel: string;
  discoverySource: string;
  categoryHint?: OpportunityType | null;
  feedKind: string; // "jsonld" | "ics" | "rss" | "html-static" | "html-js"
  scrapeTier?: string | null; // "B" | "C" for html-*; null for structured feeds (bypass the queue)
  domain?: string | null;
  country?: string | null;
  region?: string | null;
}

/**
 * Idempotently register (or refresh) a harvest target, keyed on its resolved
 * URL. Re-running the discovery connector is a no-op for already-known targets.
 */
export async function registerHarvestTarget(input: RegisterHarvestTargetInput): Promise<{ created: boolean }> {
  const existing = await prisma.harvestTarget.findUnique({ where: { url: input.url }, select: { id: true } });
  const data = {
    name: input.name,
    sourceLabel: input.sourceLabel,
    discoverySource: input.discoverySource,
    categoryHint: input.categoryHint ?? null,
    feedKind: input.feedKind,
    scrapeTier: input.scrapeTier ?? null,
    domain: input.domain ?? null,
    country: input.country ?? undefined,
    region: input.region ?? null,
  };
  if (existing) {
    await prisma.harvestTarget.update({ where: { url: input.url }, data });
    return { created: false };
  }
  await prisma.harvestTarget.create({ data: { url: input.url, ...data } });
  return { created: true };
}
