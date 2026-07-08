/**
 * Opportunity-page resolver — given an organizer's apex domain, locate its
 * events/opportunities page. Twin of careers-resolver.ts, same strategy
 * (cheap HTTP only, fail-fast on unreachable domains), different target
 * vocabulary (events/opportunities instead of careers/jobs).
 */
import { fetchWithRetry } from '../utils';

const HOME_TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 8000;

const OPPORTUNITY_PATHS = [
  '/events', '/events/', '/en/events', '/it/events',
  '/eventi', '/eventi/', '/it/eventi',
  '/opportunities', '/opportunities/', '/opportunita', '/opportunita/',
  '/calendar', '/calendario', '/agenda',
];

/** Anchor text/href that indicates an events/opportunities link (EN + IT). */
const OPPORTUNITY_LINK_RE = /(events?|eventi|opportunit|calendar|calendario|agenda)/i;

function looksLikeOpportunityPage(html: string): boolean {
  const lower = html.toLowerCase();
  return ['event', 'evento', 'eventi', 'opportunit', 'calendario', 'calendar', 'iscriviti', 'register']
    .some(s => lower.includes(s));
}

/** Find a same-site events/opportunities link in homepage HTML, resolved to an absolute URL. */
function findOpportunityLink(html: string, base: string): string | null {
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (!OPPORTUNITY_LINK_RE.test(text) && !OPPORTUNITY_LINK_RE.test(href)) continue;
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
    const res = await fetchWithRetry(url, { timeoutMs: PROBE_TIMEOUT_MS, retries: 0, logTag: `[OpportunityResolver] ${domain}` });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface ResolvedOpportunityPage {
  url: string;
  html: string;
}

export async function resolveOpportunityPage(domain: string): Promise<ResolvedOpportunityPage | null> {
  const base = `https://${domain}`;

  // 1. Homepage — fail fast if the host is unreachable (skip path probing).
  let homeHtml: string | null = null;
  try {
    const res = await fetchWithRetry(base, { timeoutMs: HOME_TIMEOUT_MS, retries: 1, logTag: `[OpportunityResolver] ${domain}` });
    if (res.ok) homeHtml = await res.text();
  } catch {
    return null; // DNS/connection failure — don't waste time probing paths
  }

  // 1a. Follow an events/opportunities nav link from the homepage.
  if (homeHtml) {
    const link = findOpportunityLink(homeHtml, base);
    if (link) {
      const html = await tryFetch(link, domain);
      if (html && looksLikeOpportunityPage(html)) return { url: link, html };
    }
  }

  // 2. Probe common opportunity paths (only reached when the host responded).
  for (const path of OPPORTUNITY_PATHS) {
    const url = base + path;
    const html = await tryFetch(url, domain);
    if (html && looksLikeOpportunityPage(html)) return { url, html };
  }

  return null;
}
