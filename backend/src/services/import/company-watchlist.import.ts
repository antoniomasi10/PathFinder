/**
 * Company Watchlist Importer
 *
 * Monitors a curated list of Italian companies (medium/large) for internship
 * and stage openings on their careers pages. Unlike the ATS-based importers,
 * this handles companies that use Workday, SAP SuccessFactors, or custom career
 * sites not covered by our 6 supported ATS connectors.
 *
 * Flow per company:
 *  1. Check robots.txt (automated, respects Disallow rules)
 *  2. Locate and analyse ToS page via OpenAI (checks for scraping prohibition)
 *  3. Fetch careers page HTML
 *  4. Extract internship listings via OpenAI
 *  5. Validate + batchUpsert using existing pipeline
 *
 * Compliance checks (robots.txt + ToS) are cached for 30 days.
 * Runs weekly Wednesday 05:30 via scheduler.ts.
 *
 * NOTE: Workday is intentionally NOT supported — ToS prohibits automated access.
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { chromium, Page } from 'playwright';
import { CompanyWatchlist } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { extractCountryCode, mapOpportunityType, fetchWithRetry, stripHtml } from './utils';
import { checkCompliance } from './compliance/gate';
import { getClient, trackedCompletion } from '../ai/openai-client';
import { parseAIDate } from '../ai/opportunityParser';

export { getClient };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FETCH_DELAY_MS = 2000;
const MAX_HTML_CHARS = 40000; // ~12k tokens after strip

// ---------------------------------------------------------------------------
// Headless browser fetch
// ---------------------------------------------------------------------------

/**
 * Returns true if the HTML contains enough job-listing signals to be worth
 * passing to the LLM extractor. Used to detect marketing/landing pages that
 * link out to a separate job board.
 */
function hasJobContent(html: string): boolean {
  const lower = html.toLowerCase();
  const signals = ['intern', 'stage', 'tirocinio', 'trainee', 'graduate program', 'junior role'];
  return signals.some(s => lower.includes(s));
}

/**
 * Scans the current page for a link to an external or sub-domain job board
 * (e.g. "See jobs & apply → jobs.company.com"). Returns the best candidate
 * URL or null if none found.
 */
async function findJobsBoardLink(page: Page, currentUrl: string): Promise<string | null> {
  try {
    const currentOrigin = new URL(currentUrl).origin;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const links: { href: string; text: string }[] = await page.$$eval(
      'a[href]',
      /* istanbul ignore next */ (els: any[]) =>
        els.map((e: any) => ({
          href: e.href as string,
          text: (e.textContent as string ?? '').trim().toLowerCase(),
        })),
    );

    const JOB_BOARD_PATTERNS = [/\/jobs\b/, /\/open-positions/, /\/careers\/jobs/, /\/job-openings/];
    const JOB_TEXT_PATTERNS = ['see jobs', 'view jobs', 'open positions', 'all jobs', 'job openings', 'apply now'];

    for (const { href, text } of links) {
      if (!href || href === currentUrl) continue;
      // Subdomain job board (e.g. jobs.company.com)
      try {
        const linkOrigin = new URL(href).origin;
        if (linkOrigin !== currentOrigin && linkOrigin.includes(new URL(currentUrl).hostname.split('.').slice(-2).join('.'))) {
          return href;
        }
      } catch { /* invalid URL */ }
      // URL path patterns
      if (JOB_BOARD_PATTERNS.some(p => p.test(href))) return href;
      // CTA text patterns
      if (JOB_TEXT_PATTERNS.some(p => text.includes(p))) return href;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Tries to click common cookie consent accept buttons (OneTrust, Cookiebot,
 * and generic text-based buttons) so content is not blocked by consent walls.
 */
async function acceptCookieConsent(page: Page): Promise<void> {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '.onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyButtonAccept',
    '#accept-all-cookies',
    '[id*="accept"][id*="cookie" i]',
    '[class*="accept"][class*="cookie" i]',
    'button[aria-label*="Accept all" i]',
    'button[aria-label*="Accetta" i]',
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click({ timeout: 2000 });
        return;
      }
    } catch { /* not present */ }
  }

  // Text-based fallback
  try {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = ((await btn.textContent()) ?? '').trim().toLowerCase();
      if (
        text === 'accetta' ||
        text === 'accetta tutto' ||
        text === 'accept all' ||
        text === 'accept cookies' ||
        text === 'i accept'
      ) {
        await btn.click();
        return;
      }
    }
  } catch { /* ignore */ }
}

/**
 * Fetches a URL using a headless Chromium browser. Handles:
 * - Cookie consent banners (OneTrust, Cookiebot, generic)
 * - SPA / JS-rendered content (scroll-to-trigger lazy loading)
 * - Inline iframe job boards (Greenhouse, Lever, etc.)
 * Falls back to empty string on any error.
 */
export async function fetchWithHeadlessBrowser(url: string): Promise<string> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'it-IT',
      viewport: { width: 1280, height: 800 },
      timezoneId: 'Europe/Rome',
    });

    // Remove navigator.webdriver flag to avoid basic bot detection
    await context.addInitScript(/* istanbul ignore next */ () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Accept cookie consent before content is revealed
    await acceptCookieConsent(page);

    // Wait for post-consent JS rendering
    await page.waitForTimeout(2500);

    // Scroll to trigger lazy-loaded job listings
    await page.evaluate(/* istanbul ignore next */ () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);
    await page.evaluate(/* istanbul ignore next */ () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight);
    });
    await page.waitForTimeout(1500);

    let html = await page.content();

    // If the page looks like a marketing/landing page (no job keywords), try to follow
    // "View Jobs" / "Apply" links to the actual job board sub-page or subdomain.
    if (!hasJobContent(html)) {
      const jobsUrl = await findJobsBoardLink(page, url);
      if (jobsUrl && jobsUrl !== url) {
        logger.info(`[CompanyWatchlist] Following jobs link: ${url} → ${jobsUrl}`);
        await page.goto(jobsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await acceptCookieConsent(page);
        await page.waitForTimeout(2500);
        await page.evaluate(/* istanbul ignore next */ () => {
          (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight);
        });
        await page.waitForTimeout(1500);
        html = await page.content();
      }
    }

    // Some ATS boards (Greenhouse, Lever) render inside iframes — append their content
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const frameHtml = await frame.content();
        if (frameHtml.length > 300) {
          const lower = frameHtml.toLowerCase();
          if (
            lower.includes('intern') ||
            lower.includes('stage') ||
            lower.includes('junior') ||
            lower.includes('trainee') ||
            lower.includes('graduate')
          ) {
            html += '\n<!-- FRAME -->\n' + frameHtml;
          }
        }
      } catch { /* cross-origin frame — skip */ }
    }

    return html;
  } catch (err) {
    logger.warn(`[CompanyWatchlist] Playwright fetch failed for ${url}: ${err}`);
    return '';
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Sector → passion tags (D2)
// ---------------------------------------------------------------------------

/**
 * Maps a sector string to the lowercase individual tags recognised by the
 * matching engine's PASSION_TAG_MAP. The sector string itself (e.g.
 * 'Finance & Banking') is already stored as a tag, but the engine compares
 * against exact lowercase tokens like 'finance', 'banking', 'startup', etc.
 * Adding the individual tokens as extra tags ensures passion-match points fire.
 */
function sectorTags(sector: string): string[] {
  const s = sector.toLowerCase();
  if (s.includes('finance') || s.includes('banking')) {
    return ['finance', 'banking', 'consulting', 'graduate'];
  }
  if (s.includes('startup') || s.includes('scaleup')) {
    return ['startup', 'entrepreneurship', 'innovation', 'business'];
  }
  if (s.includes('consulting')) {
    return ['consulting', 'strategy', 'business', 'graduate'];
  }
  if (s.includes('tech')) {
    return ['tech', 'startup', 'innovation'];
  }
  if (s.includes('venture') || s.includes('private equity') || s.includes('investimento')) {
    return ['venture capital', 'investment', 'finance', 'startup'];
  }
  if (s.includes('incubat') || s.includes('accelerat') || s.includes('ecosistema')) {
    return ['startup', 'entrepreneurship', 'innovation', 'accelerator'];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Opportunity extraction via LLM
// ---------------------------------------------------------------------------

interface RawLLMOpportunity {
  title?: string;
  url?: string;
  location?: string;
  type?: string;
  deadline?: string | null;
}

const EXTRACT_SYSTEM_PROMPT = `You are a job listing extractor. Extract all student-relevant positions from a careers page.

Only include: internship, stage, tirocinio, trainee, apprenticeship, graduate roles, junior roles, entry-level roles.
Exclude: senior, manager, director, lead, principal, staff, head of, VP, C-suite roles.

Return JSON in this exact shape: { "positions": [ { "title": "...", "url": "...", "location": "...", "type": "TIROCINIO|FELLOWSHIP|EXTRACURRICULAR", "deadline": "YYYY-MM-DD or null" } ] }

If no relevant positions found, return { "positions": [] }.
The content uses format "Job title (url)" — extract the URL from the parentheses. Use absolute URLs only.
If a position has no URL, omit the url field.`;

/**
 * Converts anchor tags to "text (url)" format with absolute URLs resolved against
 * baseUrl, then strips remaining HTML. This ensures the LLM sees job listing URLs
 * that are embedded as <a href="..."> in the source.
 */
export function htmlLinksToText(html: string, baseUrl: string): string {
  const linkified = html.replace(
    /<a\s[^>]*?href=["']([^"'>]+)["'][^>]*?>([\s\S]*?)<\/a>/gi,
    (_: string, href: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) return inner;
      let absHref = href;
      try { absHref = new URL(href, baseUrl).href; } catch { /* keep */ }
      return `${text} (${absHref})`;
    },
  );
  return stripHtml(linkified);
}

export async function extractOpportunitiesWithLLM(
  html: string,
  company: CompanyWatchlist,
): Promise<RawLLMOpportunity[]> {
  const client = getClient();
  if (!client) return [];

  try {
    // Focus on <main> if present, otherwise full body
    const scopedHtml = (() => {
      const m = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
      return m ? m[1] : html;
    })();

    // Convert links to text (preserving URLs) before stripping HTML
    let text = htmlLinksToText(scopedHtml, company.careersUrl);
    text = text.slice(0, MAX_HTML_CHARS);

    if (text.length < 50) return [];

    const response = await trackedCompletion(client, {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Company: ${company.name}\n\nCareers page content:\n\n${text}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    }, { source: 'company-watchlist', purpose: 'job-listing-extract' });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    // Handle array, {positions:[...]}, {opportunities:[...]}, {jobs:[...]} shapes
    const items: RawLLMOpportunity[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.positions) ? parsed.positions
        : Array.isArray(parsed.opportunities) ? parsed.opportunities
        : Array.isArray(parsed.jobs) ? parsed.jobs
        : []);

    return items.filter(i => typeof i.title === 'string' && i.title.length > 3);
  } catch (err) {
    logger.warn(`[CompanyWatchlist] LLM extraction failed for ${company.name}: ${err}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main import orchestration
// ---------------------------------------------------------------------------

/**
 * Builds normalized OpportunityRecords from LLM-extracted raw listings for one
 * company. Shared by the weekly batch loop, the single-company admin import, and
 * the tier B/C scrape worker so record shape / sourceId / tags stay identical.
 */
export function buildWatchlistRecords(
  company: CompanyWatchlist,
  rawOpportunities: RawLLMOpportunity[],
  now: Date,
): { records: OpportunityRecord[]; skipped: number } {
  const records: OpportunityRecord[] = [];
  let skipped = 0;

  for (const raw of rawOpportunities) {
    if (!raw.title) { skipped++; continue; }

    const opportunityUrl = raw.url || company.careersUrl;
    const location = raw.location || company.name;
    const countryCode = extractCountryCode(location) || 'IT';
    const isRemote = location.toLowerCase().includes('remote') || location.toLowerCase().includes('remoto');
    const sourceId = `company-watchlist-${company.id}-${Buffer.from(raw.title + opportunityUrl).toString('base64').slice(0, 20)}`;

    const description = [
      `${raw.title} presso ${company.name}.`,
      raw.location ? `Sede: ${raw.location}.` : null,
      `Settore: ${company.sector}.`,
    ].filter(Boolean).join(' ');

    const validated = validateOpportunity({
      title: raw.title,   // D3: no " — CompanyName" suffix — keeps dedupKey clean
      description,
      company: company.name,
      url: opportunityUrl,
      location,
      isAbroad: countryCode !== 'IT',
      isRemote,
      expiresAt: null,
      deadline: parseAIDate(raw.deadline),
    }, 'company-watchlist');

    if (!validated) { skipped++; continue; }

    records.push({
      id: sourceId,
      title: validated.title,
      description: validated.description,
      company: company.name,
      url: validated.url ?? null,
      location: validated.location || null,
      isAbroad: validated.isAbroad,
      isRemote: validated.isRemote,
      type: mapOpportunityType(raw.title, raw.type ? [raw.type] : null),
      // D2: sector + normalised passion tokens so tag-matching fires correctly
      tags: [company.sector, company.tier, ...sectorTags(company.sector)],
      postedAt: now,
      expiresAt: null,
      deadline: parseAIDate(raw.deadline),
      source: 'CompanyWatchlist',
      sourceId,
      lastSyncedAt: now,
      country: countryCode || null,
    });
  }

  return { records, skipped };
}

export async function importCompanyWatchlistOpportunities(): Promise<{
  imported: number;
  skipped: number;
  complianceBlocked: number;
  source: string;
}> {
  logger.info('[CompanyWatchlist] Starting import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: 'company-watchlist', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const companies = await prisma.companyWatchlist.findMany({
      // Only non-ATS rows are scraped here. ATS boards (atsType set, tier A) are
      // imported via the ATS factory, not headless-scraped.
      where: { isActive: true, atsType: null },
      orderBy: { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
    });

    let imported = 0;
    let skipped = 0;
    let complianceBlocked = 0;

    for (const company of companies) {
      try {
        const allowed = await processCompanyCompliance(company, now);
        if (!allowed) {
          complianceBlocked++;
          continue;
        }

        const html = await fetchWithHeadlessBrowser(company.careersUrl);

        if (!html) {
          logger.warn(`[CompanyWatchlist] ${company.name}: empty HTML from headless fetch`);
          await prisma.companyWatchlist.update({ where: { id: company.id }, data: { lastSyncedAt: now } });
          await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
          continue;
        }

        const rawOpportunities = await extractOpportunitiesWithLLM(html, company);
        const { records: companyRecords, skipped: companySkipped } = buildWatchlistRecords(company, rawOpportunities, now);
        skipped += companySkipped;

        if (companyRecords.length > 0) {
          await batchUpsertOpportunities(companyRecords);
          // D5: mark stale only for opportunities from this company that are no longer seen
          await markStaleOpportunities('CompanyWatchlist', companyRecords.map(r => r.id), {
            scopeCompanies: [company.name],
            minSeenForStale: 1,
          });
          imported += companyRecords.length;
        }

        await prisma.companyWatchlist.update({ where: { id: company.id }, data: { lastSyncedAt: now } });
        logger.info(`[CompanyWatchlist] ${company.name}: ${rawOpportunities.length} found, ${companyRecords.length} valid`);
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[CompanyWatchlist] ${company.name} failed: ${err}`);
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, complianceBlocked, total: companies.length },
      },
    });

    logger.info(`[CompanyWatchlist] Done: imported=${imported}, skipped=${skipped}, compliance_blocked=${complianceBlocked}`);
    return { imported, skipped, complianceBlocked, source: 'company-watchlist' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[CompanyWatchlist] Import failed: ${err}`);
    return { imported: 0, skipped: 0, complianceBlocked: 0, source: 'failed' };
  }
}

/**
 * Checks and updates compliance state (robots.txt + ToS) for a company.
 * Returns true if the company is allowed to be scraped.
 * Re-checks every 30 days; uses cached values otherwise.
 *
 * Thin wrapper around the generalized `checkCompliance` gate (shared with the
 * upcoming HarvestTarget harvester) — this function only adapts CompanyWatchlist's
 * two legacy timestamp columns (robotsCheckedAt/tosAnalyzedAt) to and from the
 * gate's single complianceCheckedAt cache marker.
 */
export async function processCompanyCompliance(company: CompanyWatchlist, now: Date): Promise<boolean> {
  // Use the earlier of the two per-field timestamps as the unified cache marker,
  // so a stale field on either side triggers a fresh combined check.
  const cachedAt = company.robotsCheckedAt && company.tosAnalyzedAt
    ? new Date(Math.min(company.robotsCheckedAt.getTime(), company.tosAnalyzedAt.getTime()))
    : null;

  const result = await checkCompliance(company.careersUrl, {
    robotsAllowed: company.robotsAllowed,
    tosAllowed: company.tosAllowed,
    complianceCheckedAt: cachedAt,
  }, now);

  if (result.checked) {
    const updates: Partial<CompanyWatchlist> = {
      robotsAllowed: result.robotsAllowed,
      robotsCheckedAt: now,
      tosAllowed: result.tosAllowed,
      tosAnalyzedAt: now,
      tosNotes: result.tosNotes ?? null,
      tosPageNotFound: result.tosPageNotFound ?? false,
    };
    await prisma.companyWatchlist.update({
      where: { id: company.id },
      data: updates as any,
    });
    // Use updated values for the current run
    Object.assign(company, updates);

    if (result.robotsAllowed === false) {
      logger.info(`[CompanyWatchlist] ${company.name}: robots.txt disallows scraping`);
    }
    if (result.tosAllowed === false) {
      logger.info(`[CompanyWatchlist] ${company.name}: ToS prohibits scraping — ${result.tosNotes}`);
    } else if (result.tosAllowed === null) {
      logger.info(`[CompanyWatchlist] ${company.name}: ToS status unknown — ${result.tosNotes}`);
    }
  }

  return result.allowed;
}

// ---------------------------------------------------------------------------
// Single-company import (used by admin endpoint)
// ---------------------------------------------------------------------------

export async function importSingleCompany(companyId: string): Promise<{
  imported: number;
  skipped: number;
  allowed: boolean;
}> {
  const company = await prisma.companyWatchlist.findUnique({ where: { id: companyId } });
  if (!company) throw new Error(`Company ${companyId} not found`);

  const now = new Date();
  const allowed = await processCompanyCompliance(company, now);
  if (!allowed) return { imported: 0, skipped: 0, allowed: false };

  const html = await fetchWithHeadlessBrowser(company.careersUrl);
  if (!html) return { imported: 0, skipped: 0, allowed: true };
  const rawOpportunities = await extractOpportunitiesWithLLM(html, company);
  const { records, skipped } = buildWatchlistRecords(company, rawOpportunities, now);

  if (records.length > 0) {
    await batchUpsertOpportunities(records);
    // D5: mark stale only for this company's opportunities no longer seen
    await markStaleOpportunities('CompanyWatchlist', records.map(r => r.id), {
      scopeCompanies: [company.name],
      minSeenForStale: 1,
    });
  }

  await prisma.companyWatchlist.update({
    where: { id: company.id },
    data: { lastSyncedAt: now },
  });

  return { imported: records.length, skipped, allowed: true };
}
