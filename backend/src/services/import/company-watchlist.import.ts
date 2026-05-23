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
import OpenAI from 'openai';
import { CompanyWatchlist } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, OpportunityRecord } from './batch';
import { extractCountryCode, mapOpportunityType, fetchWithRetry, stripHtml } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FETCH_DELAY_MS = 2000;
const ROBOTS_CHECK_INTERVAL_DAYS = 30;
const TOS_CHECK_INTERVAL_DAYS = 30;
const MAX_HTML_CHARS = 40000; // ~12k tokens after strip

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// ---------------------------------------------------------------------------
// robots.txt check
// ---------------------------------------------------------------------------

/**
 * Fetches and parses robots.txt for the given URL's origin.
 * Returns true if our bot is allowed to access the careers path,
 * false if explicitly disallowed.
 * On fetch error, defaults to true (benefit of the doubt).
 */
export async function checkRobotsTxt(careersUrl: string): Promise<boolean> {
  try {
    const origin = new URL(careersUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;

    const res = await fetchWithRetry(robotsUrl, {
      timeoutMs: 10000,
      retries: 1,
      headers: { 'Accept': 'text/plain' },
      logTag: '[CompanyWatchlist] robots.txt',
    });

    if (!res.ok) {
      logger.warn(`[CompanyWatchlist] robots.txt not found for ${origin} (${res.status}) — allowing`);
      return true;
    }

    const text = await res.text();
    const careersPath = new URL(careersUrl).pathname;

    return isAllowedByRobots(text, careersPath);
  } catch (err) {
    logger.warn(`[CompanyWatchlist] robots.txt fetch failed: ${err} — allowing`);
    return true;
  }
}

/**
 * Parses robots.txt text and checks if the given path is allowed
 * under User-agent: * or User-agent: COhA.
 */
function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split('\n').map(l => l.trim());
  let active = false;
  const disallowedPaths: string[] = [];
  const allowedPaths: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith('user-agent:')) {
      const agent = line.slice('user-agent:'.length).trim().toLowerCase();
      active = agent === '*' || agent === 'coha' || agent === 'googlebot';
      continue;
    }
    if (!active) continue;
    if (line.toLowerCase().startsWith('disallow:')) {
      const p = line.slice('disallow:'.length).trim();
      if (p) disallowedPaths.push(p);
    }
    if (line.toLowerCase().startsWith('allow:')) {
      const p = line.slice('allow:'.length).trim();
      if (p) allowedPaths.push(p);
    }
  }

  // Allow rules take precedence over disallow
  for (const p of allowedPaths) {
    if (path.startsWith(p)) return true;
  }
  for (const p of disallowedPaths) {
    if (p === '/' || path.startsWith(p)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// ToS analysis via LLM
// ---------------------------------------------------------------------------

const TOS_LINK_PATTERNS = [
  '/terms', '/legal', '/tos', '/terms-of-service', '/terms-of-use',
  '/termini', '/condizioni', '/privacy-policy', '/note-legali',
  '/condizioni-di-utilizzo', '/termini-di-servizio',
];

const TOS_LINK_REGEX = /href=["']([^"']*(?:terms|legal|tos|termini|condizioni|note-legali)[^"']*?)["']/gi;

/**
 * Fetches the homepage of the careers URL's domain, finds the ToS page link,
 * fetches the ToS text, and uses OpenAI to determine if scraping is allowed.
 */
export async function findAndAnalyzeTos(careersUrl: string): Promise<{
  allowed: boolean | null;
  notes: string;
  pageNotFound: boolean;
}> {
  const client = getClient();
  if (!client) {
    logger.warn('[CompanyWatchlist] No OpenAI API key — skipping ToS analysis, allowing by default');
    return { allowed: true, notes: 'OpenAI not configured — skipped', pageNotFound: false };
  }

  try {
    const origin = new URL(careersUrl).origin;

    // Fetch homepage to find ToS link
    const homeRes = await fetchWithRetry(origin, {
      timeoutMs: 15000,
      retries: 1,
      headers: { 'Accept': 'text/html' },
      logTag: '[CompanyWatchlist] homepage',
    });

    if (!homeRes.ok) {
      return { allowed: null, notes: `Homepage returned ${homeRes.status}`, pageNotFound: true };
    }

    const homeHtml = await homeRes.text();
    const tosUrl = extractTosUrl(homeHtml, origin);

    if (!tosUrl) {
      return { allowed: null, notes: 'ToS page link not found in homepage', pageNotFound: true };
    }

    // Fetch ToS page
    const tosRes = await fetchWithRetry(tosUrl, {
      timeoutMs: 15000,
      retries: 1,
      headers: { 'Accept': 'text/html' },
      logTag: '[CompanyWatchlist] ToS',
    });

    if (!tosRes.ok) {
      return { allowed: null, notes: `ToS page returned ${tosRes.status}`, pageNotFound: true };
    }

    const tosHtml = await tosRes.text();
    const tosText = stripHtml(tosHtml).slice(0, 8000);

    if (tosText.length < 100) {
      return { allowed: null, notes: 'ToS page content too short to analyse', pageNotFound: true };
    }

    // Analyse with OpenAI
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
        {
          role: 'user',
          content: `Terms of Service:\n\n${tosText}`,
        },
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
    logger.warn(`[CompanyWatchlist] ToS analysis failed: ${err}`);
    return { allowed: null, notes: `Error: ${String(err).slice(0, 200)}`, pageNotFound: true };
  }
}

function extractTosUrl(html: string, origin: string): string | null {
  // Try known patterns first
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

  // Regex fallback
  const matches = [...html.matchAll(TOS_LINK_REGEX)];
  if (matches.length > 0) {
    const href = matches[0][1];
    return href.startsWith('http') ? href : `${origin}${href}`;
  }

  return null;
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

Only include: internship, stage, tirocinio, trainee, apprenticeship, graduate program, junior roles.
Exclude: senior, manager, director, lead, principal, staff, head of, VP, C-suite roles.

Return JSON only — an array with this shape:
[{ "title": "...", "url": "...", "location": "...", "type": "INTERNSHIP|STAGE|FELLOWSHIP|EXTRACURRICULAR", "deadline": "YYYY-MM-DD or null" }]

If no relevant positions found, return empty array [].
URLs must be absolute (https://...). If only relative paths are in the HTML, skip the url field.`;

export async function extractOpportunitiesWithLLM(
  html: string,
  company: CompanyWatchlist,
): Promise<RawLLMOpportunity[]> {
  const client = getClient();
  if (!client) return [];

  try {
    // Strip HTML and truncate
    let text = stripHtml(html);

    // Try to focus on main content area
    const mainMatch = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      text = stripHtml(mainMatch[1]);
    }

    text = text.slice(0, MAX_HTML_CHARS);

    if (text.length < 50) return [];

    const response = await client.chat.completions.create({
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
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    // Handle both array and {opportunities: [...]} shapes
    const items: RawLLMOpportunity[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.opportunities) ? parsed.opportunities : []);

    return items.filter(i => typeof i.title === 'string' && i.title.length > 3);
  } catch (err) {
    logger.warn(`[CompanyWatchlist] LLM extraction failed for ${company.name}: ${err}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main import orchestration
// ---------------------------------------------------------------------------

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
      where: { isActive: true },
      orderBy: { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
    });

    let imported = 0;
    let skipped = 0;
    let complianceBlocked = 0;
    const records: OpportunityRecord[] = [];

    for (const company of companies) {
      try {
        const allowed = await processCompanyCompliance(company, now);
        if (!allowed) {
          complianceBlocked++;
          continue;
        }

        // Fetch careers page
        const res = await fetchWithRetry(company.careersUrl, {
          timeoutMs: 20000,
          retries: 1,
          headers: { 'Accept': 'text/html', 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8' },
          logTag: `[CompanyWatchlist] ${company.name}`,
        });

        if (!res.ok) {
          logger.warn(`[CompanyWatchlist] ${company.name} careers page returned ${res.status}`);
          await prisma.companyWatchlist.update({
            where: { id: company.id },
            data: { lastSyncedAt: now },
          });
          await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
          continue;
        }

        const html = await res.text();
        const rawOpportunities = await extractOpportunitiesWithLLM(html, company);

        for (const raw of rawOpportunities) {
          if (!raw.title || !raw.url) { skipped++; continue; }

          const location = raw.location || company.name;
          const countryCode = extractCountryCode(location) || 'IT';
          const isAbroad = countryCode !== 'IT';
          const isRemote = location.toLowerCase().includes('remote') ||
                           location.toLowerCase().includes('remoto');

          const sourceId = `company-watchlist-${company.id}-${Buffer.from(raw.title + raw.url).toString('base64').slice(0, 20)}`;

          const validated = validateOpportunity({
            title: `${raw.title} — ${company.name}`,
            description: `${raw.title} presso ${company.name}. ${raw.location || ''}`.trim(),
            company: company.name,
            url: raw.url,
            location,
            isAbroad,
            isRemote,
            expiresAt: null,
            deadline: raw.deadline ? new Date(raw.deadline) : null,
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
            tags: [company.sector, company.tier],
            postedAt: now,
            expiresAt: null,
            deadline: raw.deadline ? new Date(raw.deadline) : null,
            source: 'CompanyWatchlist',
            sourceId,
            lastSyncedAt: now,
            country: countryCode || null,
          });
        }

        await prisma.companyWatchlist.update({
          where: { id: company.id },
          data: { lastSyncedAt: now },
        });

        logger.info(`[CompanyWatchlist] ${company.name}: ${rawOpportunities.length} found, ${rawOpportunities.length - skipped} valid`);
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[CompanyWatchlist] ${company.name} failed: ${err}`);
      }
    }

    await batchUpsertOpportunities(records);
    imported = records.length;

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
 */
async function processCompanyCompliance(company: CompanyWatchlist, now: Date): Promise<boolean> {
  const robotsExpired = !company.robotsCheckedAt ||
    daysSince(company.robotsCheckedAt, now) > ROBOTS_CHECK_INTERVAL_DAYS;
  const tosExpired = !company.tosAnalyzedAt ||
    daysSince(company.tosAnalyzedAt, now) > TOS_CHECK_INTERVAL_DAYS;

  const updates: Partial<CompanyWatchlist> = {};

  if (robotsExpired) {
    const robotsAllowed = await checkRobotsTxt(company.careersUrl);
    updates.robotsAllowed = robotsAllowed;
    updates.robotsCheckedAt = now;
    if (!robotsAllowed) {
      logger.info(`[CompanyWatchlist] ${company.name}: robots.txt disallows scraping`);
    }
  }

  if (tosExpired) {
    const tos = await findAndAnalyzeTos(company.careersUrl);
    updates.tosAllowed = tos.allowed;
    updates.tosAnalyzedAt = now;
    updates.tosNotes = tos.notes;
    updates.tosPageNotFound = tos.pageNotFound;
    if (tos.allowed === false) {
      logger.info(`[CompanyWatchlist] ${company.name}: ToS prohibits scraping — ${tos.notes}`);
    } else if (tos.allowed === null) {
      logger.info(`[CompanyWatchlist] ${company.name}: ToS status unknown — ${tos.notes}`);
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.companyWatchlist.update({
      where: { id: company.id },
      data: updates as any,
    });
    // Use updated values for the current run
    Object.assign(company, updates);
  }

  // Block if explicitly disallowed
  if (company.robotsAllowed === false) return false;
  if (company.tosAllowed === false) return false;
  // Block if ToS is unknown (null = not found or error)
  if (company.tosAllowed === null && (updates.tosAllowed !== undefined || !tosExpired)) {
    return false;
  }

  return true;
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
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

  const res = await fetchWithRetry(company.careersUrl, {
    timeoutMs: 20000,
    retries: 1,
    headers: { 'Accept': 'text/html' },
    logTag: `[CompanyWatchlist] ${company.name}`,
  });

  if (!res.ok) return { imported: 0, skipped: 0, allowed: true };

  const html = await res.text();
  const rawOpportunities = await extractOpportunitiesWithLLM(html, company);
  const records: OpportunityRecord[] = [];
  let skipped = 0;

  for (const raw of rawOpportunities) {
    if (!raw.title || !raw.url) { skipped++; continue; }

    const location = raw.location || company.name;
    const countryCode = extractCountryCode(location) || 'IT';
    const sourceId = `company-watchlist-${company.id}-${Buffer.from(raw.title + raw.url).toString('base64').slice(0, 20)}`;

    const validated = validateOpportunity({
      title: `${raw.title} — ${company.name}`,
      description: `${raw.title} presso ${company.name}. ${raw.location || ''}`.trim(),
      company: company.name,
      url: raw.url,
      location,
      isAbroad: countryCode !== 'IT',
      isRemote: location.toLowerCase().includes('remote') || location.toLowerCase().includes('remoto'),
      expiresAt: null,
      deadline: raw.deadline ? new Date(raw.deadline) : null,
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
      tags: [company.sector, company.tier],
      postedAt: now,
      source: 'CompanyWatchlist',
      sourceId,
      lastSyncedAt: now,
      country: countryCode || null,
    });
  }

  await batchUpsertOpportunities(records);
  await prisma.companyWatchlist.update({
    where: { id: company.id },
    data: { lastSyncedAt: now },
  });

  return { imported: records.length, skipped, allowed: true };
}
