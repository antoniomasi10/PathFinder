/**
 * Shared helpers for opportunity importers.
 *
 * Factored out of 10+ importer files to eliminate drift — the per-file copies
 * were diverging (some covered Italy, others didn't; some handled `praktikum`,
 * others didn't). Keep this file authoritative.
 */
import { OpportunityType } from '@prisma/client';
import { Agent, setGlobalDispatcher } from 'undici';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Shared HTTP dispatcher — keep-alive connection pool across all importers.
// Node's built-in fetch is backed by undici; setGlobalDispatcher swaps the
// default pool for one we tune (keep-alive, sane concurrency per origin).
// Same-origin imports (Greenhouse = 50+ boards on boards-api.greenhouse.io)
// reuse TCP connections instead of re-handshaking on every request.
// ---------------------------------------------------------------------------

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 20,
  pipelining: 1,
}));

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------

/**
 * Strips HTML tags + decodes common entities. Handles CDATA wrappers (Personio
 * XML feeds) transparently.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|span|strong|em|b|i)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Country code extraction
// ---------------------------------------------------------------------------

/**
 * Best-effort mapping from a free-text location to an ISO-3166-1 alpha-2 code.
 * Returns empty string if no match — callers can fall back to '' or 'EU' etc.
 */
export function extractCountryCode(location: string): string {
  if (!location) return '';
  const loc = location.toLowerCase();

  if (loc.includes('italy') || loc.includes('italia') ||
      loc.includes('milan') || loc.includes('milano') ||
      loc.includes('rome') || loc.includes('roma') ||
      loc.includes('turin') || loc.includes('torino') ||
      loc.includes('naples') || loc.includes('napoli') ||
      loc.includes('florence') || loc.includes('firenze') ||
      loc.includes('bologna')) return 'IT';

  if (loc.includes('united states') || loc.includes('usa') ||
      loc.includes('new york') || loc.includes('san francisco') ||
      loc.includes('seattle') || loc.includes('los angeles') ||
      loc.includes('austin') || loc.includes('boston') ||
      loc.includes('chicago')) return 'US';

  if (loc.includes('united kingdom') || loc.includes('london') ||
      loc.includes(' uk') || loc.endsWith('uk') ||
      loc.includes('manchester') || loc.includes('edinburgh')) return 'GB';

  if (loc.includes('germany') || loc.includes('deutschland') ||
      loc.includes('berlin') || loc.includes('munich') || loc.includes('münchen') ||
      loc.includes('hamburg') || loc.includes('frankfurt') ||
      loc.includes('cologne') || loc.includes('köln') || loc.includes('düsseldorf')) return 'DE';

  if (loc.includes('france') || loc.includes('paris') ||
      loc.includes('lyon') || loc.includes('marseille')) return 'FR';

  if (loc.includes('netherlands') || loc.includes('amsterdam') || loc.includes('rotterdam')) return 'NL';
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
  if (loc.includes('ireland') || loc.includes('dublin')) return 'IE';
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver')) return 'CA';
  if (loc.includes('austria') || loc.includes('vienna') || loc.includes('wien')) return 'AT';
  if (loc.includes('belgium') || loc.includes('brussels') || loc.includes('bruxelles')) return 'BE';
  if (loc.includes('switzerland') || loc.includes('zurich') || loc.includes('zürich')) return 'CH';
  if (loc.includes('sweden') || loc.includes('stockholm')) return 'SE';
  if (loc.includes('norway') || loc.includes('oslo')) return 'NO';
  if (loc.includes('poland') || loc.includes('warsaw')) return 'PL';
  if (loc.includes('singapore')) return 'SG';
  if (loc.includes('japan') || loc.includes('tokyo')) return 'JP';
  if (loc.includes('australia') || loc.includes('sydney')) return 'AU';

  return '';
}

// ---------------------------------------------------------------------------
// Opportunity type mapping
// ---------------------------------------------------------------------------

/**
 * Maps a job title (and optional job_types array from the source) to our
 * OpportunityType enum. Covers EN/IT/DE/FR terminology.
 */
export function mapOpportunityType(title: string, jobTypes?: string[] | null): OpportunityType {
  if (jobTypes?.some(jt => jt.toLowerCase() === 'internship')) return 'INTERNSHIP';
  const t = title.toLowerCase();

  // Italian / English internship terms → INTERNSHIP
  if (t.includes('intern') || t.includes('tirocinio') || t.includes('traineeship')) return 'INTERNSHIP';

  // French / Italian "stage" → STAGE
  if (t.includes('stage') || t.includes('stagiaire')) return 'STAGE';

  // German / FR / DE categories → STAGE
  if (t.includes('praktikum') || t.includes('praktikant')) return 'STAGE';
  if (t.includes('trainee') || t.includes('werkstudent')) return 'STAGE';
  if (t.includes('apprenti') || t.includes('alternance') ||
      t.includes('duales studium') || t.includes('co-op')) return 'STAGE';

  if (t.includes('graduate') || t.includes('fellow')) return 'FELLOWSHIP';

  return 'INTERNSHIP';
}

// ---------------------------------------------------------------------------
// Cross-source dedup key
// ---------------------------------------------------------------------------

/**
 * Build a normalized key identifying "the same opportunity" across sources.
 *
 * The same posting often appears on Greenhouse + an aggregator + the company's
 * Personio feed, each with a different `sourceId`. By normalizing title+company
 * (lowercase, strip punctuation/role-decoration) we can detect and skip the
 * cross-source duplicates at insert time.
 *
 * Returns null if inputs are too short/empty to produce a meaningful key —
 * callers should NOT use that as a dedup signal (treat as "no match").
 */
export function buildDedupKey(title: string, company: string | null | undefined): string | null {
  const norm = (s: string) =>
    s.toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')      // drop accents
      .replace(/\(.*?\)|\[.*?\]/g, ' ')                        // drop bracketed qualifiers ((m/f/d), [remote])
      .replace(/\b(m\s*[\/|]\s*f\s*[\/|]\s*d|m\/w\/d|h\/f|m\/f)\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const t = norm(title);
  const c = norm(company || '');
  if (t.length < 3 || c.length < 2) return null;
  return `${t}|${c}`;
}

// ---------------------------------------------------------------------------
// HTTP fetch with retries + exponential backoff
// ---------------------------------------------------------------------------

export interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /** Tag for logs (e.g. "[Greenhouse] cloudflare") */
  logTag?: string;
}

/** Identifiable UA so upstream APIs can reach us instead of silently blocking. */
const DEFAULT_USER_AGENT = 'PathFinder/1.0 (+https://pathfinder.example/about; university-student-platform)';

/**
 * fetch with:
 *  - retry on 429 (respects Retry-After header) and 5xx up to `retries` times
 *  - exponential backoff between attempts (1s, 2s, 4s, ... capped)
 *  - hard timeout per attempt
 *  - default User-Agent header (can be overridden via options.headers)
 *
 * Returns the final Response (may still be !res.ok after retries). Throws only
 * on network/abort errors that couldn't be retried.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 15000,
    retries = 3,
    baseBackoffMs = 1000,
    maxBackoffMs = 60000,
    method = 'GET',
    body,
    logTag,
  } = options;

  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept-Encoding': 'gzip, deflate, br',
    ...(options.headers || {}),
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        body,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (retryable && attempt < retries) {
        const retryAfterHdr = res.headers.get('retry-after');
        let delay = retryAfterHdr ? parseInt(retryAfterHdr, 10) * 1000 : NaN;
        if (!Number.isFinite(delay) || delay <= 0) {
          delay = Math.min(baseBackoffMs * 2 ** attempt, maxBackoffMs);
        }
        if (logTag) {
          logger.warn(`${logTag} got ${res.status} — retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        }
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt >= retries) break;
      const delay = Math.min(baseBackoffMs * 2 ** attempt, maxBackoffMs);
      if (logTag) {
        logger.warn(`${logTag} fetch error ${err?.name || err} — retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      }
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('fetchWithRetry: retries exhausted');
}

// ---------------------------------------------------------------------------
// Bounded concurrency pool
// ---------------------------------------------------------------------------

/**
 * Runs `worker(item)` over `items` with at most `concurrency` in flight.
 * Unlike Promise.allSettled over the whole list, this throttles outbound
 * requests so we don't open 50 sockets to a slow API at once.
 *
 * Failures are logged but never reject the pool — importers must handle
 * per-item errors internally (which they already do via try/catch).
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = items.slice();
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        await worker(item);
      } catch (err) {
        logger.warn(`[runWithConcurrency] worker threw: ${err}`);
      }
    }
  });
  await Promise.all(runners);
}
