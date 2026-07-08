/**
 * Generalized opportunity extraction for HarvestTarget pages — decoupled from
 * CompanyWatchlist's job-listing-only extractOpportunitiesWithLLM
 * (company-watchlist.import.ts). Organizer pages list events/hackathons/summer
 * schools/fellowships, not job openings, so the extraction target (dates,
 * format, location, cost) and prompt are different; the HTML→text preprocessing
 * (htmlLinksToText) and OpenAI client are shared, not duplicated.
 */
import { HarvestTarget, OpportunityFormat, OpportunityType } from '@prisma/client';
import { logger } from '../../../utils/logger';
import { validateOpportunity } from '../validation';
import { OpportunityRecord } from '../batch';
import { extractCountryCode, stripHtml } from '../utils';
import { getClient, htmlLinksToText } from '../company-watchlist.import';

const MAX_HTML_CHARS = 40000; // ~12k tokens after strip, same budget as CompanyWatchlist

export interface ExtractionContext {
  sourceLabel: string;
  organizer: string;
  url: string;
  categoryHint?: OpportunityType | null;
}

export interface RawExtractedOpportunity {
  title?: string;
  url?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  format?: string;
  cost?: number;
  deadline?: string | null;
  description?: string;
}

const OPPORTUNITY_TYPES = [
  'TIROCINIO', 'EXTRACURRICULAR', 'EVENT', 'FELLOWSHIP', 'SUMMER_PROGRAM',
  'HACKATHON', 'COMPETITION', 'EXCHANGE', 'VOLUNTEERING', 'BOOTCAMP', 'RESEARCH',
];

const EXTRACT_SYSTEM_PROMPT = `You are an opportunity listing extractor. Extract all student-relevant opportunities (events, hackathons, summer schools, fellowships, competitions, exchanges, volunteering) from an organizer's page.

Return JSON in this exact shape: { "items": [ {
  "title": "...",
  "url": "... (absolute URL)",
  "type": "one of ${OPPORTUNITY_TYPES.join('|')}",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "location": "city/venue or null",
  "format": "ONLINE|IN_PERSON|HYBRID or null",
  "cost": 0 or a number in EUR, or null if unknown,
  "deadline": "YYYY-MM-DD application/registration deadline, or null",
  "description": "1-3 sentence summary"
} ] }

If no relevant opportunities found, return { "items": [] }.
The content uses format "Text (url)" — extract the URL from the parentheses. Use absolute URLs only.
Skip generic navigation links, sponsor logos, and past/expired listings.`;

/**
 * Calls the LLM to extract raw opportunity listings from a harvest target's
 * page HTML. Returns [] when no OpenAI key is configured (same fail-open
 * behavior as extractOpportunitiesWithLLM) or on any extraction error.
 */
export async function extractOpportunitiesFromPage(
  html: string,
  ctx: ExtractionContext,
): Promise<RawExtractedOpportunity[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const scopedHtml = (() => {
      const m = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
      return m ? m[1] : html;
    })();

    let text = htmlLinksToText(scopedHtml, ctx.url);
    text = text.slice(0, MAX_HTML_CHARS);
    if (text.length < 50) return [];

    const categoryLine = ctx.categoryHint
      ? `\n\nBias: most opportunities on this page are likely of type ${ctx.categoryHint}, but extract whatever is actually present.`
      : '';

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Organizer: ${ctx.organizer}${categoryLine}\n\nPage content:\n\n${text}`,
        },
      ],
      max_tokens: 3000,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const items: RawExtractedOpportunity[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.items) ? parsed.items
        : Array.isArray(parsed.opportunities) ? parsed.opportunities
        : []);

    return items.filter(i => typeof i.title === 'string' && i.title.length > 3);
  } catch (err) {
    logger.warn(`[HarvestExtraction] LLM extraction failed for ${ctx.organizer}: ${err}`);
    return [];
  }
}

function resolveType(raw: string | undefined, categoryHint: OpportunityType | null | undefined): OpportunityType {
  if (raw && (OPPORTUNITY_TYPES as string[]).includes(raw)) return raw as OpportunityType;
  return categoryHint ?? 'EVENT';
}

function resolveFormat(raw: string | undefined): OpportunityFormat | null {
  if (raw === 'ONLINE' || raw === 'IN_PERSON' || raw === 'HYBRID') return raw;
  return null;
}

/**
 * Maps raw LLM-extracted listings for one harvest target into OpportunityRecords.
 * Twin of buildWatchlistRecords (company-watchlist.import.ts) — populates
 * `organizer` (not `company`, events don't have a company) and event fields
 * (startDate/endDate/format) instead of job-only fields.
 */
export function buildHarvestRecords(
  target: HarvestTarget,
  raw: RawExtractedOpportunity[],
  now: Date,
): { records: OpportunityRecord[]; skipped: number } {
  const records: OpportunityRecord[] = [];
  let skipped = 0;

  for (const item of raw) {
    if (!item.title) { skipped++; continue; }

    const opportunityUrl = item.url || target.url;
    const location = item.location || null;
    const countryCode = (location && extractCountryCode(location)) || target.country || null;
    const isAbroad = !!countryCode && countryCode !== 'IT';
    const format = resolveFormat(item.format);
    const isRemote = format === 'ONLINE' || format === 'HYBRID';
    const type = resolveType(item.type, target.categoryHint);

    const startDate = item.startDate ? new Date(item.startDate) : null;
    const endDate = item.endDate ? new Date(item.endDate) : null;
    const deadline = item.deadline ? new Date(item.deadline) : null;
    const description = stripHtml(item.description || `${item.title} — ${target.name}.`).slice(0, 10000);

    const sourceId = `harvest-${target.id}-${Buffer.from(item.title + opportunityUrl).toString('base64').slice(0, 20)}`;

    const validated = validateOpportunity({
      title: item.title.slice(0, 250),
      description,
      company: null,
      organizer: target.name,
      url: opportunityUrl,
      location,
      isAbroad,
      isRemote,
      expiresAt: deadline ?? endDate ?? null,
      deadline,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
      format,
      city: null,
      country: countryCode,
      cost: typeof item.cost === 'number' ? item.cost : null,
      hasScholarship: false,
      eligibleFields: [],
      verified: false,
    }, 'HarvestTarget');

    if (!validated) { skipped++; continue; }

    records.push({
      id: sourceId,
      title: validated.title,
      description: validated.description,
      company: null,
      organizer: target.name,
      url: validated.url ?? null,
      location: validated.location || null,
      isAbroad: validated.isAbroad,
      isRemote: validated.isRemote,
      type,
      tags: [target.sourceLabel],
      postedAt: now,
      expiresAt: validated.expiresAt ?? null,
      deadline,
      source: 'HarvestTarget',
      sourceId,
      lastSyncedAt: now,
      startDate: validated.startDate ?? null,
      endDate: validated.endDate ?? null,
      format,
      country: countryCode,
      cost: validated.cost ?? null,
      hasScholarship: false,
      eligibleFields: [],
      verified: false,
    });
  }

  return { records, skipped };
}
