/**
 * Careers-page resolver — given a company apex domain, locate its careers page.
 *
 * Strategy (cheap HTTP only; the headless path is reserved for the scrape worker):
 *   1. fetch the homepage (fail-fast: if the domain is unreachable we stop here —
 *      no point probing 14 paths on a dead host)
 *   2. follow a "careers / lavora con noi" nav link, else probe common paths
 *
 * All probes use retries:0 + a short timeout so a large seed list stays fast:
 * a missing path is expected, not an error worth backing off on.
 *
 * Returns the resolved URL plus the fetched HTML (so the caller can fingerprint
 * without re-fetching). Returns null when nothing careers-like is found.
 */
import { fetchWithRetry } from '../utils';

const HOME_TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 8000;

const CAREERS_PATHS = [
  '/careers', '/careers/', '/en/careers', '/it/careers',
  '/lavora-con-noi', '/lavora-con-noi/', '/it/lavora-con-noi',
  '/jobs', '/en/jobs', '/company/careers', '/about/careers',
  '/join-us', '/work-with-us', '/posizioni-aperte', '/carriere',
];

/** Anchor text/href that indicates a careers link (EN + IT). */
const CAREERS_LINK_RE = /(careers?|lavora con noi|posizioni aperte|carriere|join us|work with us|opportunit)/i;

function looksLikeCareers(html: string): boolean {
  const lower = html.toLowerCase();
  return ['career', 'lavora con noi', 'posizioni', 'tirocin', 'intern', 'stage', 'job', 'candidat']
    .some(s => lower.includes(s));
}

/** Find a same-site careers link in homepage HTML, resolved to an absolute URL. */
function findCareersLink(html: string, base: string): string | null {
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (!CAREERS_LINK_RE.test(text) && !CAREERS_LINK_RE.test(href)) continue;
    try {
      const url = new URL(href, base);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch { /* skip malformed href */ }
  }
  return null;
}

/** GET a URL fast (single attempt); returns the HTML on 2xx, else null. */
async function tryFetch(url: string, domain: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(url, { timeoutMs: PROBE_TIMEOUT_MS, retries: 0, logTag: `[Resolver] ${domain}` });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface ResolvedCareers {
  url: string;
  html: string;
}

export async function resolveCareersUrl(domain: string): Promise<ResolvedCareers | null> {
  const base = `https://${domain}`;

  // 1. Homepage — fail fast if the host is unreachable (skip path probing).
  let homeHtml: string | null = null;
  try {
    const res = await fetchWithRetry(base, { timeoutMs: HOME_TIMEOUT_MS, retries: 1, logTag: `[Resolver] ${domain}` });
    if (res.ok) homeHtml = await res.text();
  } catch {
    return null; // DNS/connection failure → don't waste time probing paths
  }

  // 1a. Follow a careers nav link from the homepage.
  if (homeHtml) {
    const link = findCareersLink(homeHtml, base);
    if (link) {
      const html = await tryFetch(link, domain);
      if (html && looksLikeCareers(html)) return { url: link, html };
    }
  }

  // 2. Probe common careers paths (only reached when the host responded).
  for (const path of CAREERS_PATHS) {
    const url = base + path;
    const html = await tryFetch(url, domain);
    if (html && looksLikeCareers(html)) return { url, html };
  }

  return null;
}
