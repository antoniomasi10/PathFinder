/**
 * Careers-page resolver — given a company apex domain, locate its careers page.
 *
 * Strategy (cheap HTTP only; the headless path is reserved for the scrape worker):
 *   1. fetch the homepage and follow a "careers / lavora con noi" nav link
 *   2. otherwise probe a list of common careers paths
 *
 * Returns the resolved URL plus the fetched HTML (so the caller can fingerprint
 * without re-fetching). Returns null when nothing careers-like is found.
 */
import { fetchWithRetry } from '../utils';

const CAREERS_PATHS = [
  '/careers', '/careers/', '/en/careers', '/it/careers',
  '/lavora-con-noi', '/lavora-con-noi/', '/it/lavora-con-noi',
  '/jobs', '/en/jobs', '/company/careers', '/about/careers',
  '/join-us', '/work-with-us', '/posizioni-aperte', '/carriere',
];

/** Anchor text that indicates a careers link (EN + IT). */
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

export interface ResolvedCareers {
  url: string;
  html: string;
}

export async function resolveCareersUrl(domain: string): Promise<ResolvedCareers | null> {
  const base = `https://${domain}`;

  // 1. Homepage → follow a careers nav link.
  try {
    const res = await fetchWithRetry(base, { timeoutMs: 15000, logTag: `[Resolver] ${domain}` });
    if (res.ok) {
      const homeHtml = await res.text();
      const link = findCareersLink(homeHtml, base);
      if (link) {
        try {
          const r2 = await fetchWithRetry(link, { timeoutMs: 15000, logTag: `[Resolver] ${domain} careers` });
          if (r2.ok) {
            const html = await r2.text();
            if (looksLikeCareers(html)) return { url: link, html };
          }
        } catch { /* fall through to path probing */ }
      }
    }
  } catch { /* fall through */ }

  // 2. Common careers paths.
  for (const path of CAREERS_PATHS) {
    const url = base + path;
    try {
      const res = await fetchWithRetry(url, { timeoutMs: 12000, logTag: `[Resolver] ${domain}${path}` });
      if (res.ok) {
        const html = await res.text();
        if (looksLikeCareers(html)) return { url, html };
      }
    } catch { /* try next path */ }
  }

  return null;
}
