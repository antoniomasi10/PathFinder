/**
 * Discovery orchestrator.
 *
 * Runs every DiscoveryConnector, dedups candidates, and registers harvest targets
 * in the CompanyWatchlist registry. Two kinds of candidate:
 *
 *  1. ATS candidates (atsType + atsToken already known, from the ATS-index seed):
 *     validated against the live board API → registered tier A.
 *
 *  2. Domain candidates (apex domain only — the primary engine): resolve the
 *     company's own careers page, fingerprint the ATS, then ROUTE:
 *       - permitted ATS + token → tier A (direct API import)
 *       - prohibited ATS (Workday/SuccessFactors/…) → registered no-harvest
 *       - custom page → tier B/C scrape target (queued, per-company compliance)
 *
 * The ATS is only ever a *signal*; prohibited ATS are never scraped.
 */
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { fetchWithRetry, runWithConcurrency } from '../utils';
import { registerAtsBoard, registerScrapeTarget } from '../ats/registry';
import { ATS_ADAPTER_BY_PLATFORM } from '../ats/adapters';
import { CompanyCandidate, DiscoveryConnector } from './types';
import { atsSeedConnector } from './connectors/ats-seed.connector';
import { companyDomainConnector } from './connectors/company-domain.connector';
import { universityCareersConnector } from './connectors/university-careers.connector';
import { claimRegistryBatch, reconcileRegistryBatch } from './connectors/company-registry.connector';
import { resolveCareersUrl } from './careers-resolver';
import { fingerprintAts, classifyCustomTier } from './ats-fingerprint';
import { PERMITTED_ATS } from './ats-policy';

/** All active discovery connectors. Add new connectors here. */
export const DISCOVERY_CONNECTORS: DiscoveryConnector[] = [
  atsSeedConnector,
  companyDomainConnector,
  universityCareersConnector,
];

const PROBE_CONCURRENCY = 5;
const RESOLVE_CONCURRENCY = 4; // careers-page resolution is heavier (multiple fetches)

// --- Fase 5 company-registry discovery (see runRegistryDiscovery) ---
const REGISTRY_DISCOVERY_ENABLED = process.env.REGISTRY_DISCOVERY_ENABLED !== 'false';
const REGISTRY_DISCOVERY_DAILY_LIMIT = Number(process.env.REGISTRY_DISCOVERY_DAILY_LIMIT ?? 400);

export interface DiscoveryOutcome {
  discovered: number;
  tierA: number;        // registered as permitted-ATS boards
  custom: number;       // registered as tier B/C scrape targets
  blocked: number;      // prohibited ATS → no-harvest
  unresolved: number;   // no careers page found
  invalid: number;      // ATS candidate whose board API didn't validate
  created: number;      // newly-created registry rows
}

/** True if the board's API responds OK (board exists; may have 0 open roles). */
async function boardExists(platform: string, token: string, name: string): Promise<boolean> {
  const adapter = ATS_ADAPTER_BY_PLATFORM[platform];
  if (!adapter) return true; // non-factory permitted platform (personio/smartrecruiters)
  try {
    const res = await fetchWithRetry(adapter.buildUrl(token), {
      timeoutMs: adapter.timeoutMs ?? 15000,
      headers: { Accept: 'application/json' },
      logTag: `[Discovery] probe ${name}`,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolve + fingerprint + route a single domain candidate. */
export async function routeDomainCandidate(c: CompanyCandidate, out: DiscoveryOutcome): Promise<void> {
  const resolved = await resolveCareersUrl(c.domain!);
  if (!resolved) {
    out.unresolved++;
    logger.info(`[Discovery] ${c.name}: no careers page found`);
    return;
  }

  // Fingerprint over the final URL + page HTML.
  const fp = fingerprintAts(`${resolved.url}\n${resolved.html}`);

  if (fp && fp.compliance === 'permitted' && fp.token && PERMITTED_ATS.has(fp.platform)) {
    const r = await registerAtsBoard({
      platform: fp.platform, token: fp.token, name: c.name,
      discoverySource: c.source, domain: c.domain ?? null, country: c.country ?? null,
      sector: c.sector,
    });
    out.tierA++; if (r.created) out.created++;
    logger.info(`[Discovery] ${c.name}: ${fp.platform}/${fp.token} → tier A`);
    return;
  }

  if (fp && fp.compliance === 'prohibited') {
    const r = await registerScrapeTarget({
      name: c.name, careersUrl: resolved.url, discoverySource: c.source,
      atsType: fp.platform, domain: c.domain ?? null, country: c.country ?? null,
      sector: c.sector, blocked: true,
    });
    out.blocked++; if (r.created) out.created++;
    logger.info(`[Discovery] ${c.name}: ${fp.platform} (prohibited) → no-harvest`);
    return;
  }

  // Custom / unknown page → tier B/C scrape target.
  const tier = classifyCustomTier(resolved.html);
  const r = await registerScrapeTarget({
    name: c.name, careersUrl: resolved.url, discoverySource: c.source,
    atsType: tier === 'B' ? 'custom-static' : 'custom-js', scrapeTier: tier,
    domain: c.domain ?? null, country: c.country ?? null, sector: c.sector,
  });
  out.custom++; if (r.created) out.created++;
  logger.info(`[Discovery] ${c.name}: custom → tier ${tier}`);
}

export async function runDiscovery(options?: { validate?: boolean }): Promise<DiscoveryOutcome> {
  const validate = options?.validate ?? true;
  logger.info('[Discovery] Starting company discovery...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: 'discovery', type: 'companies', status: 'running', startedAt: now },
  });

  const out: DiscoveryOutcome = { discovered: 0, tierA: 0, custom: 0, blocked: 0, unresolved: 0, invalid: 0, created: 0 };

  try {
    // Gather + dedup candidates (key: platform|token, else domain).
    const byKey = new Map<string, CompanyCandidate>();
    for (const connector of DISCOVERY_CONNECTORS) {
      try {
        const candidates = await connector.discover();
        for (const c of candidates) {
          const key = c.atsType && c.atsToken ? `${c.atsType}|${c.atsToken}` : `domain|${c.domain}`;
          if (!byKey.has(key)) byKey.set(key, c);
        }
        logger.info(`[Discovery] ${connector.name}: ${candidates.length} candidates`);
      } catch (err) {
        logger.warn(`[Discovery] connector ${connector.name} failed: ${err}`);
      }
    }

    const candidates = [...byKey.values()];
    out.discovered = candidates.length;

    const atsCandidates = candidates.filter(c => c.atsType && c.atsToken);
    const domainCandidates = candidates.filter(c => !(c.atsType && c.atsToken) && c.domain);

    // 1. Pre-resolved ATS boards → validate + register tier A.
    await runWithConcurrency(atsCandidates, PROBE_CONCURRENCY, async (c) => {
      if (validate && !(await boardExists(c.atsType!, c.atsToken!, c.name))) {
        out.invalid++;
        logger.info(`[Discovery] invalid/dead board skipped: ${c.atsType}/${c.atsToken} (${c.name})`);
        return;
      }
      const r = await registerAtsBoard({
        platform: c.atsType!, token: c.atsToken!, name: c.name,
        discoverySource: c.source, domain: c.domain ?? null, country: c.country ?? null, sector: c.sector,
      });
      out.tierA++; if (r.created) out.created++;
    });

    // 2. Domain candidates → resolve → fingerprint → route.
    await runWithConcurrency(domainCandidates, RESOLVE_CONCURRENCY, (c) => routeDomainCandidate(c, out));

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: out.tierA + out.custom, finishedAt: new Date(), metadata: { ...out } },
    });
    logger.info(`[Discovery] Done. ${JSON.stringify(out)}`);
    return out;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Discovery] Failed: ${err}`);
    return out;
  }
}

/**
 * Fase 5 company-first scale-up: drains a priority-ordered batch of
 * CompanyRegistry candidates through the SAME resolve→fingerprint→route path
 * as the seed connectors, then reconciles each row against CompanyWatchlist to
 * mark it promoted/unresolved/pending-retry. The `status` column is the
 * resumable cursor, so this is safe to call daily with a small `limit` without
 * ever reprocessing already-claimed rows out of order.
 */
export async function runRegistryDiscovery(
  options?: { limit?: number; validate?: boolean },
): Promise<DiscoveryOutcome & { promoted: number; exhausted: number }> {
  const out: DiscoveryOutcome & { promoted: number; exhausted: number } = {
    discovered: 0, tierA: 0, custom: 0, blocked: 0, unresolved: 0, invalid: 0, created: 0, promoted: 0, exhausted: 0,
  };

  if (!REGISTRY_DISCOVERY_ENABLED) {
    logger.info('[Discovery] Registry discovery disabled (REGISTRY_DISCOVERY_ENABLED=false)');
    return out;
  }

  const validate = options?.validate ?? true;
  const limit = options?.limit ?? REGISTRY_DISCOVERY_DAILY_LIMIT;
  logger.info(`[Discovery] Starting registry discovery (limit=${limit})...`);
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: 'registry-discovery', type: 'companies', status: 'running', startedAt: now },
  });

  try {
    const rows = await claimRegistryBatch(limit);
    out.discovered = rows.length;

    const atsRows = rows.filter(r => r.atsType && r.atsToken);
    const domainRows = rows.filter(r => !(r.atsType && r.atsToken) && r.domain);

    // 1. Fast path: rows that already carry a known ATS token (Common Crawl harvest).
    await runWithConcurrency(atsRows, PROBE_CONCURRENCY, async (row) => {
      if (validate && !(await boardExists(row.atsType!, row.atsToken!, row.name))) {
        out.invalid++;
        return;
      }
      const r = await registerAtsBoard({
        platform: row.atsType!, token: row.atsToken!, name: row.name,
        discoverySource: `registry:${row.source}`, domain: row.domain ?? null, country: 'IT', sector: row.sector ?? undefined,
      });
      out.tierA++; if (r.created) out.created++;
    });

    // 2. Domain candidates → resolve → fingerprint → route (shared with seed connectors).
    await runWithConcurrency(domainRows, RESOLVE_CONCURRENCY, (row) => {
      const candidate: CompanyCandidate = {
        name: row.name, domain: row.domain!, country: 'IT',
        sector: row.sector ?? undefined, source: `registry:${row.source}`,
      };
      return routeDomainCandidate(candidate, out);
    });

    const { promoted, exhausted } = await reconcileRegistryBatch(rows);
    out.promoted = promoted;
    out.exhausted = exhausted;

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: out.tierA + out.custom, finishedAt: new Date(), metadata: { ...out } },
    });
    logger.info(`[Discovery] Registry discovery done. ${JSON.stringify(out)}`);
    return out;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Discovery] Registry discovery failed: ${err}`);
    return out;
  }
}
