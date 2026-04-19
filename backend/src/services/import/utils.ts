/**
 * Shared helpers for opportunity importers.
 *
 * Factored out of 10+ importer files to eliminate drift — the per-file copies
 * were diverging (some covered Italy, others didn't; some handled `praktikum`,
 * others didn't). Keep this file authoritative.
 */
import { FieldOfStudy, OpportunityType } from '@prisma/client';
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
 * Maps a job/event title (and optional type tags from source) to our OpportunityType enum.
 * Covers EN/IT/DE/FR terminology. More specific types are checked first to avoid
 * false positives (e.g. "summer intern" should resolve to INTERNSHIP, not SUMMER_PROGRAM).
 */
export function mapOpportunityType(title: string, jobTypes?: string[] | null): OpportunityType {
  const jt = jobTypes?.map(j => j.toLowerCase()) ?? [];
  const t = title.toLowerCase();

  // --- Source-declared type tags (highest priority) ---
  if (jt.includes('internship')) return 'INTERNSHIP';
  if (jt.includes('hackathon')) return 'HACKATHON';
  if (jt.includes('volunteer') || jt.includes('volunteering')) return 'VOLUNTEERING';
  if (jt.includes('exchange')) return 'EXCHANGE';

  // --- Hackathon / competition ---
  if (t.includes('hackathon') || t.includes('hackatlon')) return 'HACKATHON';
  if (t.includes('datathon') || t.includes('codefest')) return 'HACKATHON';
  if (t.includes('case competition') || t.includes('business competition') ||
      t.includes('pitch competition') || t.includes('startup competition') ||
      t.includes('formula student') || t.includes('formula sae') ||
      t.includes('igem') || t.includes('nasa space apps') ||
      t.includes('imagine cup') || t.includes('premio') ||
      t.includes('award') || t.includes('challenge')) return 'COMPETITION';

  // --- Research program ---
  if (t.includes('research program') || t.includes('research fellowship') ||
      t.includes('summer research') || t.includes('research stay') ||
      t.includes('research scholar') || t.includes('research internship') ||
      t.includes('cern summer') || t.includes('laboratory placement')) return 'RESEARCH';

  // --- Summer program / bootcamp (check before "intern" to avoid swallowing "summer intern") ---
  if ((t.includes('summer school') || t.includes('scuola estiva') ||
       t.includes('summer academy') || t.includes('winter school')) &&
      !t.includes('intern')) return 'SUMMER_PROGRAM';
  if (t.includes('summer program') && !t.includes('intern')) return 'SUMMER_PROGRAM';
  if (t.includes('bootcamp') || t.includes('boot camp') ||
      t.includes('intensive course') || t.includes('coding course')) return 'BOOTCAMP';

  // --- Conference / event ---
  if (t.includes('conference') || t.includes('conferenza') ||
      t.includes('congresso') || t.includes('symposium') ||
      t.includes('forum') || t.includes('summit') && !t.includes('intern')) return 'CONFERENCE';
  if (t.includes('tedx') || t.includes('ted talk') || t.includes('meetup') ||
      t.includes('networking event') || t.includes('open day')) return 'EVENT';

  // --- Exchange / volunteer ---
  if (t.includes('erasmus') || t.includes('exchange program') ||
      t.includes('aiesec') || t.includes('ifmsa') ||
      t.includes('scambio') || t.includes('rotary youth') ||
      t.includes('youth exchange') || t.includes('cultural exchange')) return 'EXCHANGE';
  if (t.includes('volunteer') || t.includes('volontariato') ||
      t.includes('european solidarity') || t.includes('service civile') ||
      t.includes('corps') || t.includes('corps')) return 'VOLUNTEERING';

  // --- Internship / stage (EN/IT/DE/FR) ---
  if (t.includes('intern') || t.includes('tirocinio') || t.includes('traineeship')) return 'INTERNSHIP';
  if (t.includes('stage') || t.includes('stagiaire')) return 'STAGE';
  if (t.includes('praktikum') || t.includes('praktikant')) return 'STAGE';
  if (t.includes('trainee') || t.includes('werkstudent')) return 'STAGE';
  if (t.includes('apprenti') || t.includes('alternance') ||
      t.includes('duales studium') || t.includes('co-op')) return 'STAGE';

  // --- Fellowship (graduate programs, named fellowships) ---
  if (t.includes('fellow') || t.includes('graduate program') ||
      t.includes('graduate scheme') || t.includes('leadership program') ||
      t.includes('silicon valley') || t.includes('scholar')) return 'FELLOWSHIP';

  return 'INTERNSHIP';
}

// ---------------------------------------------------------------------------
// FieldOfStudy normalizer
// ---------------------------------------------------------------------------

const FIELD_KEYWORD_MAP: Array<{ keywords: string[]; field: FieldOfStudy }> = [
  { keywords: ['computer science', 'informatica', 'software', 'computing', 'data science', 'ai ', 'machine learning', 'cybersecurity', 'information technology', 'it '], field: 'COMPUTER_SCIENCE' },
  { keywords: ['engineer', 'ingegneria', 'mechanical', 'electrical', 'civil', 'aerospace', 'chemical engineering', 'biomedical engineering', 'industrial engineering'], field: 'ENGINEERING' },
  { keywords: ['medicine', 'medical', 'medicina', 'clinical', 'surgery', 'pharmacy', 'dental', 'nursing', 'healthcare professional'], field: 'MEDICINE' },
  { keywords: ['biology', 'biologia', 'biochemistry', 'biotech', 'biotechnology', 'life science', 'genetics', 'ecology', 'microbiology'], field: 'LIFE_SCIENCES' },
  { keywords: ['physics', 'fisica', 'chemistry', 'chimica', 'astronomy', 'geoscience', 'material science'], field: 'PHYSICAL_SCIENCES' },
  { keywords: ['mathematics', 'matematica', 'statistics', 'statistica', 'actuarial', 'quantitative'], field: 'MATHEMATICS' },
  { keywords: ['economics', 'economia', 'econom', 'finance', 'finanza', 'banking', 'accounting'], field: 'ECONOMICS' },
  { keywords: ['business', 'management', 'marketing', 'mba', 'bba', 'entrepreneurship', 'strategy', 'commerce'], field: 'BUSINESS' },
  { keywords: ['law', 'legge', 'giurisprudenza', 'legal', 'jurisprudence', 'diritto'], field: 'LAW' },
  { keywords: ['political science', 'scienze politiche', 'politics', 'international relations', 'policy', 'diplomacy', 'public administration'], field: 'POLITICAL_SCIENCE' },
  { keywords: ['humanities', 'lettere', 'literature', 'history', 'philosophy', 'linguistics', 'language', 'arts', 'cultura'], field: 'HUMANITIES' },
  { keywords: ['design', 'graphic', 'ux', 'ui ', 'fashion', 'product design', 'architecture interior', 'visual'], field: 'DESIGN' },
  { keywords: ['architecture', 'architettura', 'urban planning', 'urbanistica'], field: 'ARCHITECTURE' },
  { keywords: ['psychology', 'psicologia', 'neuroscience', 'behavioral', 'cognitive'], field: 'PSYCHOLOGY' },
  { keywords: ['education', 'pedagogia', 'teaching', 'pedagogy', 'training'], field: 'EDUCATION' },
];

/**
 * Maps a free-text field-of-study string (from scraper sources) to a FieldOfStudy enum value.
 * Returns 'ANY' if no match — callers should treat ANY as "open to all disciplines".
 */
export function normalizeFieldToEnum(raw: string): FieldOfStudy {
  const r = raw.toLowerCase();
  for (const { keywords, field } of FIELD_KEYWORD_MAP) {
    if (keywords.some(kw => r.includes(kw))) return field;
  }
  return 'ANY';
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
 * For events/hackathons without a company, pass `organizer` as the second arg.
 *
 * Returns null if inputs are too short/empty to produce a meaningful key —
 * callers should NOT use that as a dedup signal (treat as "no match").
 */
export function buildDedupKey(title: string, companyOrOrganizer: string | null | undefined): string | null {
  const company = companyOrOrganizer;
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

// ---------------------------------------------------------------------------
// RSS feed parser (lightweight, no external dependency)
// ---------------------------------------------------------------------------

export interface RSSItem {
  title: string;
  link: string;
  pubDate: Date | null;
  description: string;   // stripped plain text
  rawHtml: string;       // raw HTML from description/content:encoded for further parsing
  categories: string[];
  guid: string;
}

/**
 * Parses an RSS 2.0 feed XML string into structured items.
 * Handles CDATA wrappers and both <description> and <content:encoded>.
 */
export function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  for (const block of blocks) {
    const get = (tag: string): string => {
      const re = new RegExp(`<${tag}[^>]*?>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(re);
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    };

    const title = get('title');
    const link = get('link') || get('guid');
    if (!title || !link) continue;

    const pubDateStr = get('pubDate');
    const rawHtml = get('content:encoded') || get('description');
    const categories: string[] = [];
    for (const m of block.matchAll(/<category[^>]*?>([^<]+)<\/category>/gi)) {
      categories.push(m[1].trim());
    }

    items.push({
      title,
      link,
      pubDate: pubDateStr ? new Date(pubDateStr) : null,
      description: stripHtml(rawHtml),
      rawHtml,
      categories,
      guid: get('guid') || link,
    });
  }

  return items;
}
