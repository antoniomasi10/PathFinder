/**
 * Shared compliance helpers for import sources.
 *
 * Provides robots.txt checking and ToS analysis via LLM so every importer —
 * not just CompanyWatchlist — can gate scraping behind the same legal checks.
 *
 * Cache intervals (30 days) match the CompanyWatchlist DB schema; callers are
 * responsible for comparing checkedAt timestamps and deciding when to re-run.
 */

import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { fetchWithRetry, stripHtml } from './utils';

export const ROBOTS_CHECK_INTERVAL_DAYS = 30;
export const TOS_CHECK_INTERVAL_DAYS = 30;

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/**
 * Fetches and parses robots.txt for the given URL's origin.
 * Returns true if our bot is allowed to access the path; false if disallowed.
 * Defaults to true on fetch errors (benefit of the doubt).
 */
export async function checkRobotsTxt(careersUrl: string): Promise<boolean> {
  try {
    const origin = new URL(careersUrl).origin;
    const res = await fetchWithRetry(`${origin}/robots.txt`, {
      timeoutMs: 10000,
      retries: 1,
      headers: { Accept: 'text/plain' },
      logTag: '[Compliance] robots.txt',
    });

    if (!res.ok) {
      logger.warn(`[Compliance] robots.txt not found for ${origin} (${res.status}) — allowing`);
      return true;
    }

    const text = await res.text();
    const path = new URL(careersUrl).pathname;
    return isAllowedByRobots(text, path);
  } catch (err) {
    logger.warn(`[Compliance] robots.txt fetch failed: ${err} — allowing`);
    return true;
  }
}

/**
 * Parses robots.txt content and determines if the given path is allowed.
 * Applies blocks whose User-agent is `*` or `coha`. Per RFC 9309, the rule
 * with the *longest matching pattern* wins (not first-match-in-file-order) —
 * a broad `Allow: /jobs` followed later by a narrower `Disallow: /jobs/*`
 * (a real pattern seen on euraxess.ec.europa.eu) must still block `/jobs/*`.
 * Ties are resolved in favor of Allow, matching Google's documented behavior.
 *
 * A group of directives ends only when a *new* User-agent line follows
 * directives already collected for the current group — never on a blank
 * line. Many real robots.txt files (euraxess.ec.europa.eu among them) use
 * blank lines purely as visual spacing *within* a single User-agent block
 * to separate rule categories (CSS/JS allows, directory disallows, API
 * disallows, …); treating those as group boundaries silently drops every
 * directive after the first blank line.
 */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt
    .split('\n')
    .map(l => l.replace(/#.*/, '').trim())
    .filter(l => l.length > 0);

  type Block = { agents: string[]; allow: string[]; disallow: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    if (line.toLowerCase().startsWith('user-agent:')) {
      const agent = line.slice('user-agent:'.length).trim().toLowerCase();
      if (!current) {
        current = { agents: [agent], allow: [], disallow: [] };
      } else if (current.allow.length === 0 && current.disallow.length === 0) {
        current.agents.push(agent);
      } else {
        blocks.push(current);
        current = { agents: [agent], allow: [], disallow: [] };
      }
      continue;
    }
    if (!current) continue;
    if (line.toLowerCase().startsWith('disallow:')) {
      const p = line.slice('disallow:'.length).trim();
      if (p) current.disallow.push(p);
    } else if (line.toLowerCase().startsWith('allow:')) {
      const p = line.slice('allow:'.length).trim();
      if (p) current.allow.push(p);
    }
    // Any other directive (Sitemap:, Crawl-delay:, Host:, …) is ignored.
  }
  if (current) blocks.push(current);

  let best: { length: number; allow: boolean } | null = null;
  for (const block of blocks) {
    if (!block.agents.some(a => a === '*' || a === 'coha')) continue;
    for (const p of block.allow) {
      if (matchesRobotsPattern(path, p) && (!best || p.length >= best.length)) {
        best = { length: p.length, allow: true };
      }
    }
    for (const p of block.disallow) {
      if (matchesRobotsPattern(path, p) && (!best || p.length > best.length)) {
        best = { length: p.length, allow: false };
      }
    }
  }
  return best ? best.allow : true;
}

/**
 * Matches a URL path against a robots.txt Allow/Disallow pattern, per the
 * de-facto spec: `*` matches any run of characters, and a trailing `$`
 * anchors the match to the end of the path. Without `$` the match is a
 * (wildcard-aware) prefix, same as plain robots.txt prefix rules.
 *
 * A naive `path.startsWith(pattern)` — the previous implementation — never
 * matches wildcard patterns like `Disallow: /jobs/*` because `*` is treated
 * as a literal character, silently under-blocking those paths.
 */
function matchesRobotsPattern(path: string, pattern: string): boolean {
  const endAnchored = pattern.endsWith('$');
  const body = endAnchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}${endAnchored ? '$' : ''}`);
  return regex.test(path);
}

// ---------------------------------------------------------------------------
// ToS analysis
// ---------------------------------------------------------------------------

const TOS_LINK_PATTERNS = [
  '/terms', '/legal', '/tos', '/terms-of-service', '/terms-of-use',
  '/termini', '/condizioni', '/privacy-policy', '/note-legali',
  '/condizioni-di-utilizzo', '/termini-di-servizio',
];

const TOS_LINK_REGEX =
  /href=["']([^"']*(?:terms|legal|tos|termini|condizioni|note-legali)[^"']*?)["']/gi;

export interface TosResult {
  allowed: boolean | null;
  notes: string;
  pageNotFound: boolean;
}

/**
 * Fetches the homepage of the careers URL's domain, finds the ToS link,
 * fetches the ToS text, and uses OpenAI to determine if scraping is allowed.
 *
 * Returns `allowed: true` when the ToS is silent on automated access (conservative
 * default — we only block on EXPLICIT prohibition). Returns `allowed: null` when
 * the ToS page cannot be found or analysed.
 */
export async function findAndAnalyzeTos(careersUrl: string): Promise<TosResult> {
  const client = getClient();
  if (!client) {
    logger.warn('[Compliance] No OpenAI API key — skipping ToS analysis, allowing by default');
    return { allowed: true, notes: 'OpenAI not configured — skipped', pageNotFound: false };
  }

  try {
    const origin = new URL(careersUrl).origin;

    const homeRes = await fetchWithRetry(origin, {
      timeoutMs: 15000,
      retries: 1,
      headers: { Accept: 'text/html' },
      logTag: '[Compliance] homepage',
    });
    if (!homeRes.ok) {
      return { allowed: null, notes: `Homepage returned ${homeRes.status}`, pageNotFound: true };
    }

    const homeHtml = await homeRes.text();
    const tosUrl = extractTosUrl(homeHtml, origin);
    if (!tosUrl) {
      return { allowed: null, notes: 'ToS link not found in homepage', pageNotFound: true };
    }

    const tosRes = await fetchWithRetry(tosUrl, {
      timeoutMs: 15000,
      retries: 1,
      headers: { Accept: 'text/html' },
      logTag: '[Compliance] ToS',
    });
    if (!tosRes.ok) {
      return { allowed: null, notes: `ToS page returned ${tosRes.status}`, pageNotFound: true };
    }

    const tosText = stripHtml(await tosRes.text()).slice(0, 8000);
    if (tosText.length < 100) {
      return { allowed: null, notes: 'ToS page content too short to analyse', pageNotFound: true };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a legal compliance assistant. Determine whether the Terms of Service explicitly prohibits automated/programmatic access, web scraping, or crawling.

Answer with JSON only: { "allowed": true/false, "confidence": "high"/"medium"/"low", "reason": "..." }

Rules:
- "allowed: false" ONLY if there is EXPLICIT prohibition of scraping, crawling, or automated access
- "allowed: true" if the ToS is silent on the matter or permissive
- Keep "reason" under 100 characters`,
        },
        { role: 'user', content: `Terms of Service:\n\n${tosText}` },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(raw) as { allowed?: boolean; confidence?: string; reason?: string };

    return {
      allowed: result.allowed ?? true,
      notes: `[${result.confidence ?? '?'}] ${result.reason ?? ''}`.slice(0, 500),
      pageNotFound: false,
    };
  } catch (err) {
    logger.warn(`[Compliance] ToS analysis failed: ${err}`);
    return { allowed: null, notes: `Error: ${String(err).slice(0, 200)}`, pageNotFound: true };
  }
}

function extractTosUrl(html: string, origin: string): string | null {
  for (const pattern of TOS_LINK_PATTERNS) {
    const idx = html.toLowerCase().indexOf(`href="${pattern}`);
    if (idx !== -1) {
      const end = html.indexOf('"', idx + 6);
      if (end !== -1) {
        const href = html.slice(idx + 6, end);
        return href.startsWith('http') ? href : `${origin}${href}`;
      }
    }
  }
  const matches = [...html.matchAll(TOS_LINK_REGEX)];
  if (matches.length > 0) {
    const href = matches[0][1];
    return href.startsWith('http') ? href : `${origin}${href}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Convenience helper
// ---------------------------------------------------------------------------

/**
 * Returns the number of days elapsed since `date`.
 * Exported so callers (CompanyWatchlist, future importers) can decide if
 * their cached compliance data has expired without importing from node-cron.
 */
export function daysSince(date: Date, now: Date = new Date()): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}
