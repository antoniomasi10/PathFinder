/**
 * Common Crawl ATS-token harvester — the highest-yield, zero-legal-risk source
 * in the Fase 5 company-first scale-up: instead of scanning `*.it` for careers
 * paths (would need the columnar/parquet index, tens of GB — out of scope for
 * this codebase), this queries the public CDX index API for URLs already
 * hosted on the ATS platforms we support, which are by construction tier-A
 * candidates (no careers-page resolution needed).
 *
 * Every token found is probed against the *live* ATS public API (never the
 * crawl archive itself) and kept only if at least one open role is Italy/EU-
 * remote — this is the gate that stops thousands of global boards from
 * flooding the registry. Tokens already known in CompanyWatchlist are skipped.
 *
 * CC BY 4.0 index; ~1 req/s to both the CDX API and the ATS APIs.
 */
import { logger } from '../../../../utils/logger';
import { fetchWithRetry, extractCountryCode } from '../../utils';
import { ATS_ADAPTER_BY_PLATFORM } from '../../ats/adapters';
import { getRegistryBoards } from '../../ats/registry';
import { RegistryEntity, RegistryLoader } from '../types';

const CDX_ENDPOINT = (crawlId: string) => `https://index.commoncrawl.org/${crawlId}-index`;
const MAX_PAGES_PER_PLATFORM = 20;
const MAX_TOKENS_PROBED_PER_RUN = 1500; // bounds worst-case runtime at ~1 probe/s
const PROBE_DELAY_MS = 1000;

interface PlatformQuery {
  platform: string;
  url: string;
  matchType?: 'domain';
}

const PLATFORM_QUERIES: PlatformQuery[] = [
  { platform: 'greenhouse', url: 'boards.greenhouse.io/*' },
  { platform: 'lever', url: 'jobs.lever.co/*' },
  { platform: 'ashby', url: 'jobs.ashbyhq.com/*' },
  { platform: 'workable', url: 'apply.workable.com/*' },
  { platform: 'recruitee', url: 'recruitee.com', matchType: 'domain' },
];

const GENERIC_RECRUITEE_SUBDOMAINS = new Set(['www', 'api', 'jobs', 'careers', 'app']);

/** Extract { platform, token } from a hosted-ATS URL (Common Crawl hit or otherwise). */
export function extractAtsToken(url: string): { platform: string; token: string } | null {
  let m: RegExpExecArray | null;
  if ((m = /^https?:\/\/boards\.greenhouse\.io\/([a-z0-9_-]+)/i.exec(url))) return { platform: 'greenhouse', token: m[1].toLowerCase() };
  if ((m = /^https?:\/\/jobs\.lever\.co\/([a-z0-9_-]+)/i.exec(url))) return { platform: 'lever', token: m[1].toLowerCase() };
  if ((m = /^https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i.exec(url))) return { platform: 'ashby', token: m[1].toLowerCase() };
  if ((m = /^https?:\/\/apply\.workable\.com\/([a-z0-9_-]+)/i.exec(url))) return { platform: 'workable', token: m[1].toLowerCase() };
  if ((m = /^https?:\/\/([a-z0-9_-]+)\.recruitee\.com/i.exec(url))) {
    const token = m[1].toLowerCase();
    return GENERIC_RECRUITEE_SUBDOMAINS.has(token) ? null : { platform: 'recruitee', token };
  }
  return null;
}

async function latestCrawlId(): Promise<string> {
  const res = await fetchWithRetry('https://index.commoncrawl.org/collinfo.json', {
    timeoutMs: 15000, logTag: '[CommonCrawl] collinfo',
  });
  const collections = await res.json() as { id: string }[];
  if (!collections?.[0]?.id) throw new Error('[CommonCrawl] could not resolve latest crawl id from collinfo.json');
  return collections[0].id;
}

async function fetchCdxPage(crawlId: string, query: PlatformQuery, page: number): Promise<string[]> {
  const params = new URLSearchParams({ url: query.url, output: 'json', collapse: 'urlkey', page: String(page) });
  if (query.matchType) params.set('matchType', query.matchType);
  try {
    const res = await fetchWithRetry(`${CDX_ENDPOINT(crawlId)}?${params.toString()}`, {
      timeoutMs: 20000, retries: 2, logTag: `[CommonCrawl] ${query.platform} page ${page}`,
    });
    if (!res.ok) return []; // CDX returns 404 for "no captures" pages — treated as end-of-results
    const text = await res.text();
    return text.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Collect unique { platform, token } candidates from the CDX index for every configured platform. */
async function collectCandidateTokens(crawlId: string, platformFilter?: string): Promise<Map<string, { platform: string; token: string }>> {
  const byKey = new Map<string, { platform: string; token: string }>();
  const queries = platformFilter ? PLATFORM_QUERIES.filter(q => q.platform === platformFilter) : PLATFORM_QUERIES;

  for (const query of queries) {
    for (let page = 0; page < MAX_PAGES_PER_PLATFORM; page++) {
      const lines = await fetchCdxPage(crawlId, query, page);
      if (lines.length === 0) break;

      for (const line of lines) {
        try {
          const { url } = JSON.parse(line) as { url: string };
          const found = extractAtsToken(url);
          if (!found) continue;
          byKey.set(`${found.platform}|${found.token}`, found);
        } catch { /* malformed line — skip */ }
      }
      logger.info(`[CommonCrawl] ${query.platform} page ${page}: ${lines.length} rows (${byKey.size} unique tokens so far)`);
      await new Promise(r => setTimeout(r, PROBE_DELAY_MS));
    }
  }
  return byKey;
}

/** True if any open role on this board is Italy-based or explicitly remote. */
async function boardHasItalyRelevantRole(platform: string, token: string): Promise<boolean> {
  const adapter = ATS_ADAPTER_BY_PLATFORM[platform];
  if (!adapter) return false;
  try {
    const res = await fetchWithRetry(adapter.buildUrl(token), {
      timeoutMs: adapter.timeoutMs ?? 15000, retries: 1, headers: { Accept: 'application/json' },
      logTag: `[CommonCrawl] probe ${platform}/${token}`,
    });
    if (!res.ok) return false;
    const raw = await res.json();
    const jobs = adapter.parseJobs(raw, { token, companyName: token });
    return jobs.some(j => {
      const loc = (j.location || '').toLowerCase();
      if (j.isRemote || loc.includes('remote')) return true;
      return extractCountryCode(loc) === 'IT';
    });
  } catch {
    return false;
  }
}

export const commonCrawlAtsLoader: RegistryLoader = {
  source: 'commoncrawl-ats',
  async load(opts?: { filePath?: string; platform?: string }): Promise<RegistryEntity[]> {
    const platformFilter = opts?.platform;

    const crawlId = await latestCrawlId();
    logger.info(`[CommonCrawl] Using crawl ${crawlId}${platformFilter ? ` (platform=${platformFilter})` : ''}`);

    const candidates = [...(await collectCandidateTokens(crawlId, platformFilter)).values()];

    // Skip tokens we already track, grouped per platform to keep the lookup cheap.
    const knownByPlatform = new Map<string, Record<string, string>>();
    const toProbe: { platform: string; token: string }[] = [];
    for (const c of candidates) {
      if (!knownByPlatform.has(c.platform)) {
        knownByPlatform.set(c.platform, await getRegistryBoards(c.platform));
      }
      if (knownByPlatform.get(c.platform)![c.token]) continue; // already an active CompanyWatchlist board
      toProbe.push(c);
    }

    const capped = toProbe.slice(0, MAX_TOKENS_PROBED_PER_RUN);
    if (toProbe.length > capped.length) {
      logger.info(`[CommonCrawl] Capping probe batch: ${toProbe.length} candidates → ${capped.length} (MAX_TOKENS_PROBED_PER_RUN)`);
    }

    const entities: RegistryEntity[] = [];
    let probed = 0;
    for (const c of capped) {
      const relevant = await boardHasItalyRelevantRole(c.platform, c.token);
      probed++;
      if (relevant) {
        entities.push({
          name: c.token,
          sourceRef: `${c.platform}|${c.token}`,
          atsType: c.platform,
          atsToken: c.token,
        });
      }
      if (probed % 50 === 0) logger.info(`[CommonCrawl] Probed ${probed}/${capped.length} (${entities.length} Italy-relevant so far)`);
      await new Promise(r => setTimeout(r, PROBE_DELAY_MS));
    }

    logger.info(`[CommonCrawl] Done: ${candidates.length} candidate tokens, ${capped.length} probed, ${entities.length} Italy-relevant`);
    return entities;
  },
};
