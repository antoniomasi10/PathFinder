/**
 * Harvest discovery orchestrator — twin of discovery.orchestrator.ts, for
 * HarvestTarget (organizer opportunity pages) instead of CompanyWatchlist
 * (company careers pages). Runs every HarvestConnector, resolves each
 * candidate's opportunity page, fingerprints the feed kind, and registers it.
 *
 * No routing decision needed here (unlike the ATS orchestrator's permitted/
 * prohibited split) — every resolved page becomes a HarvestTarget; the
 * per-target compliance gate (processTargetCompliance) runs at scrape time,
 * same as CompanyWatchlist.
 */
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { runWithConcurrency } from '../utils';
import { registerHarvestTarget } from './harvest-registry';
import { resolveOpportunityPage } from './opportunity-page-resolver';
import { fingerprintFeed } from './feed-fingerprint';
import { HarvestCandidate, HarvestConnector } from './harvest-types';
import { studentOrgsConnector } from './connectors/student-orgs.connector';

/** All active harvest-discovery connectors. Add new connectors here. */
export const HARVEST_CONNECTORS: HarvestConnector[] = [
  studentOrgsConnector,
];

const RESOLVE_CONCURRENCY = 4; // opportunity-page resolution is heavier (multiple fetches)

interface HarvestDiscoveryOutcome {
  discovered: number;
  registered: number;
  unresolved: number;
  created: number;
}

function tierForFeedKind(kind: string): string | null {
  if (kind === 'html-static') return 'B';
  if (kind === 'html-js') return 'C';
  return null; // jsonld/ics/rss bypass the queue entirely
}

async function routeCandidate(c: HarvestCandidate, out: HarvestDiscoveryOutcome): Promise<void> {
  const resolved = await resolveOpportunityPage(c.domain);
  if (!resolved) {
    out.unresolved++;
    logger.info(`[HarvestDiscovery] ${c.name}: no opportunity page found`);
    return;
  }

  const fp = fingerprintFeed(resolved.html, resolved.url);
  const url = fp.feedUrl ?? resolved.url;

  const r = await registerHarvestTarget({
    name: c.name,
    url,
    sourceLabel: c.sourceLabel,
    discoverySource: c.source,
    categoryHint: c.categoryHint ?? null,
    feedKind: fp.kind,
    scrapeTier: tierForFeedKind(fp.kind),
    domain: c.domain,
    country: c.country ?? null,
    region: c.region ?? null,
  });
  out.registered++;
  if (r.created) out.created++;
  logger.info(`[HarvestDiscovery] ${c.name}: ${fp.kind} → ${url}`);
}

export async function runHarvestDiscovery(): Promise<HarvestDiscoveryOutcome> {
  logger.info('[HarvestDiscovery] Starting opportunity-page discovery...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: 'harvest-discovery', type: 'harvest-targets', status: 'running', startedAt: now },
  });

  const out: HarvestDiscoveryOutcome = { discovered: 0, registered: 0, unresolved: 0, created: 0 };

  try {
    const byDomain = new Map<string, HarvestCandidate>();
    for (const connector of HARVEST_CONNECTORS) {
      try {
        const candidates = await connector.discover();
        for (const c of candidates) if (!byDomain.has(c.domain)) byDomain.set(c.domain, c);
        logger.info(`[HarvestDiscovery] ${connector.name}: ${candidates.length} candidates`);
      } catch (err) {
        logger.warn(`[HarvestDiscovery] connector ${connector.name} failed: ${err}`);
      }
    }

    const candidates = [...byDomain.values()];
    out.discovered = candidates.length;

    await runWithConcurrency(candidates, RESOLVE_CONCURRENCY, (c) => routeCandidate(c, out));

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: out.registered, finishedAt: new Date(), metadata: { ...out } },
    });
    logger.info(`[HarvestDiscovery] Done. ${JSON.stringify(out)}`);
    return out;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[HarvestDiscovery] Failed: ${err}`);
    return out;
  }
}
