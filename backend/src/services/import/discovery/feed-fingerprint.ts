/**
 * Feed-kind fingerprinting for opportunity pages — twin of ats-fingerprint.ts,
 * but detects the *access pattern* (structured feed vs HTML) instead of the ATS
 * platform. Drives routing: structured feeds (JSON-LD/ICS/RSS) bypass the scrape
 * queue entirely (0 LLM, direct fetch); HTML falls back to the existing tier B/C
 * scrape queue with LLM extraction.
 */
import { extractJsonLdEvents } from './jsonld-parser';

export type FeedKind = 'jsonld' | 'ics' | 'rss' | 'html-static' | 'html-js';

export interface FeedFingerprint {
  kind: FeedKind;
  /** Absolute feed URL, when different from the page itself (ics/rss). */
  feedUrl?: string;
}

function resolveHref(href: string, pageUrl: string): string | undefined {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return undefined;
  }
}

function findLinkHref(html: string, typePattern: RegExp): string | null {
  const linkRe = /<link\b[^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    if (!typePattern.test(tag)) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) return hrefMatch[1];
  }
  return null;
}

/**
 * Heuristic tier for a custom (non-feed) opportunity page based on its static
 * HTML — own signal set (event/opportunity vocabulary), NOT ats-fingerprint.ts's
 * classifyCustomTier, whose signals ("intern", "candidati", "posizioni"...) are
 * careers-page-specific and would misclassify genuine static event pages as
 * JS-rendered. Same SPA-shell heuristic (empty root mount point) either way.
 */
function classifyHtmlTier(html: string): 'B' | 'C' {
  const lower = html.toLowerCase();
  const signals = [
    'event', 'evento', 'eventi', 'hackathon', 'workshop', 'conference', 'conferenza',
    'calendario', 'calendar', 'iscriviti', 'iscrizione', 'register', 'partecipa',
    'opportunit', 'summer school', 'scholarship', 'borsa di studio',
  ];
  const hits = signals.filter(s => lower.includes(s)).length;
  const looksSpa = /<div[^>]+id=["'](root|app|__next)["']/i.test(html) && lower.replace(/\s/g, '').length < 4000;
  return hits >= 2 && !looksSpa ? 'B' : 'C';
}

/**
 * Detects the feed kind for a fetched opportunity-page candidate. Order of
 * preference (cheapest/most reliable first): JSON-LD Event > ICS link > RSS
 * link > HTML (static vs JS-heavy via the same heuristic used for career pages).
 */
export function fingerprintFeed(html: string, pageUrl: string): FeedFingerprint {
  if (extractJsonLdEvents(html).length > 0) {
    return { kind: 'jsonld' };
  }

  const icsHref = findLinkHref(html, /type=["']text\/calendar["']/i);
  if (icsHref) {
    const feedUrl = resolveHref(icsHref, pageUrl);
    if (feedUrl) return { kind: 'ics', feedUrl };
  }

  const rssHref = findLinkHref(html, /type=["']application\/(rss|atom)\+xml["']/i);
  if (rssHref) {
    const feedUrl = resolveHref(rssHref, pageUrl);
    if (feedUrl) return { kind: 'rss', feedUrl };
  }

  const tier = classifyHtmlTier(html);
  return { kind: tier === 'B' ? 'html-static' : 'html-js' };
}
