/**
 * Devfolio Hackathon Import
 * Source: https://devfolio.co/hackathons (public listing page)
 *
 * No documented public API — the page is Next.js SSR and embeds the full result
 * set (open/upcoming/past/featured hackathons) as JSON in a <script id="__NEXT_DATA__">
 * tag. We parse that JSON directly; zero LLM, zero extra requests per hackathon.
 *
 * Legal basis: robots.txt fully permits (`Disallow:` empty); ToS makes no mention
 * of scraping/automated access (verified via findAndAnalyzeTos, 2026-07-04).
 *
 * Yield note: Devfolio is heavily India-centric (in-person events outside IT/EU).
 * Only `is_online: true` hackathons are IT-relevant under our definition (HACKATHON
 * is not in the isAbroad carve-out) — expect a small remote-only subset, not the
 * bulk of the category.
 *
 * Runs weekly Tuesday at 04:45 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry } from './utils';

const LISTING_URL = 'https://devfolio.co/hackathons';
const SOURCE_KEY = 'devfolio';

interface DevfolioHackathon {
  uuid: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_online: boolean;
  timezone: string;
  settings?: { site?: string | null; reg_starts_at?: string | null; reg_ends_at?: string | null };
}

export function extractNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function collectHackathons(nextData: any): DevfolioHackathon[] {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
  const seen = new Map<string, DevfolioHackathon>();
  for (const q of queries) {
    const data = q?.state?.data;
    if (!data || typeof data !== 'object') continue;
    for (const key of ['open_hackathons', 'upcoming_hackathons', 'featured_hackathons']) {
      const arr = data[key];
      if (Array.isArray(arr)) for (const h of arr) if (h?.uuid) seen.set(h.uuid, h);
    }
  }
  return [...seen.values()];
}

// in-person Devfolio hackathons are ~always outside IT; only remote ones stay local
export function resolveIsAbroad(isOnline: boolean): boolean {
  return !isOnline;
}

export function resolveFormat(isOnline: boolean): 'ONLINE' | 'IN_PERSON' {
  return isOnline ? 'ONLINE' : 'IN_PERSON';
}

export async function importDevfolioOpportunities(): Promise<{
  imported: number; skipped: number; source: string;
}> {
  logger.info('[Devfolio] Starting hackathon import...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const res = await fetchWithRetry(LISTING_URL, {
      timeoutMs: 20000,
      headers: { Accept: 'text/html' },
      logTag: '[Devfolio]',
    });
    if (!res.ok) throw new Error(`Listing fetch failed: HTTP ${res.status}`);

    const html = await res.text();
    const nextData = extractNextData(html);
    if (!nextData) throw new Error('__NEXT_DATA__ not found — page structure may have changed');

    const hackathons = collectHackathons(nextData);
    logger.info(`[Devfolio] Found ${hackathons.length} hackathons in listing`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];

    for (const h of hackathons) {
      try {
        const startDate = new Date(h.starts_at);
        const endDate = new Date(h.ends_at);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { skipped++; continue; }

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
        const isRemote = !!h.is_online;
        const isAbroad = resolveIsAbroad(isRemote);
        const format = resolveFormat(isRemote);
        // No structured country field from Devfolio — timezone is the only geo signal.
        // Do not guess a specific country from an IANA zone name (many share one zone);
        // leave country null and let the geo-backfill pass resolve it later if possible.
        const url = h.settings?.site || `https://devfolio.co/hackathons/${h.slug}`;
        const sid = `devfolio-${h.uuid}`;
        const title = h.name.slice(0, 250);
        const description = [
          `Hackathon${isRemote ? ' online' : ' in presenza'} organizzato tramite Devfolio.`,
          h.settings?.reg_ends_at ? `Iscrizioni entro: ${h.settings.reg_ends_at}.` : null,
          `Maggiori informazioni: ${url}`,
        ].filter(Boolean).join(' ');

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: 'Devfolio',
          url,
          location: isRemote ? 'Online' : null,
          isAbroad,
          isRemote,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format,
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
        }, SOURCE_KEY);
        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: 'Devfolio',
          url,
          location: isRemote ? 'Online' : null,
          isAbroad,
          isRemote,
          type: 'HACKATHON',
          tags: ['hackathon', 'devfolio', ...(isRemote ? ['online'] : [])],
          postedAt: startDate,
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format,
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
        });
      } catch (err) {
        logger.warn(`[Devfolio] Error processing "${h.name?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);
    await markStaleOpportunities(SOURCE_KEY, records.map(r => r.id), { minSeenForStale: 3 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: records.length, finishedAt: new Date(), metadata: { skipped, totalFetched: hackathons.length } },
    });
    logger.info(`[Devfolio] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Devfolio] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
