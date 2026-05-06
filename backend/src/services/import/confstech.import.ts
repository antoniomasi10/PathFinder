/**
 * Confs.tech Conference Import
 * Source: https://github.com/tech-conferences/conference-data (MIT License)
 *
 * Confs.tech is an open-source, crowd-sourced directory of tech conferences.
 * Data is contributed by conference organizers themselves via GitHub PRs.
 * MIT license explicitly permits reuse and redistribution.
 *
 * We fetch JSON files directly from the GitHub raw API (no auth needed).
 * Each topic file contains conferences for a given year.
 * The same conference can appear across multiple topic files — we dedup by name.
 *
 * Runs weekly Wednesday at 03:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry, fetchMetaDescription, runWithConcurrency } from './utils';
import { FieldOfStudy } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RAW_BASE = 'https://raw.githubusercontent.com/tech-conferences/conference-data/master/conferences';
const SOURCE_KEY = 'confstech';
const FETCH_DELAY_MS = 300;
// Enrich up to this many conferences with website meta descriptions (rate-limits external requests)
const META_ENRICH_LIMIT = 60;

// Topics to fetch — covers tech, design, data, leadership
const TOPICS = [
  'general', 'javascript', 'typescript', 'python', 'data', 'security',
  'devops', 'ux', 'api', 'rust', 'networking', 'ios', 'android',
  'sre', 'testing', 'performance', 'opensource', 'leadership', 'product',
];

// ---------------------------------------------------------------------------
// Topic → FieldOfStudy mapping
// ---------------------------------------------------------------------------

const TOPIC_FIELDS: Record<string, FieldOfStudy[]> = {
  general:     ['COMPUTER_SCIENCE'],
  javascript:  ['COMPUTER_SCIENCE'],
  typescript:  ['COMPUTER_SCIENCE'],
  python:      ['COMPUTER_SCIENCE', 'MATHEMATICS'],
  data:        ['COMPUTER_SCIENCE', 'MATHEMATICS'],
  security:    ['COMPUTER_SCIENCE', 'ENGINEERING'],
  devops:      ['COMPUTER_SCIENCE', 'ENGINEERING'],
  ux:          ['DESIGN', 'COMPUTER_SCIENCE'],
  api:         ['COMPUTER_SCIENCE'],
  rust:        ['COMPUTER_SCIENCE', 'ENGINEERING'],
  networking:  ['COMPUTER_SCIENCE', 'ENGINEERING'],
  ios:         ['COMPUTER_SCIENCE'],
  android:     ['COMPUTER_SCIENCE'],
  sre:         ['COMPUTER_SCIENCE', 'ENGINEERING'],
  testing:     ['COMPUTER_SCIENCE'],
  performance: ['COMPUTER_SCIENCE', 'ENGINEERING'],
  opensource:  ['COMPUTER_SCIENCE'],
  leadership:  ['BUSINESS'],
  product:     ['BUSINESS', 'DESIGN', 'COMPUTER_SCIENCE'],
};

// ---------------------------------------------------------------------------
// Country name → ISO-2 (confs.tech uses full country names)
// ---------------------------------------------------------------------------

const COUNTRY_ISO: Record<string, string> = {
  // Europe
  'italy': 'IT', 'france': 'FR', 'germany': 'DE', 'spain': 'ES',
  'netherlands': 'NL', 'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'scotland': 'GB', 'wales': 'GB',
  'poland': 'PL', 'austria': 'AT', 'switzerland': 'CH',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
  'belgium': 'BE', 'portugal': 'PT', 'czechia': 'CZ', 'czech republic': 'CZ',
  'hungary': 'HU', 'romania': 'RO', 'croatia': 'HR', 'greece': 'GR',
  'ukraine': 'UA', 'turkey': 'TR', 'russia': 'RU', 'ireland': 'IE',
  'slovakia': 'SK', 'slovenia': 'SI', 'bulgaria': 'BG', 'serbia': 'RS',
  'luxembourg': 'LU', 'iceland': 'IS', 'latvia': 'LV', 'lithuania': 'LT',
  'estonia': 'EE', 'malta': 'MT', 'cyprus': 'CY', 'albania': 'AL',
  'north macedonia': 'MK', 'bosnia': 'BA', 'moldova': 'MD', 'georgia': 'GE',
  'armenia': 'AM', 'azerbaijan': 'AZ', 'belarus': 'BY',
  // Americas
  'usa': 'US', 'united states': 'US', 'united states of america': 'US',
  'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR',
  'colombia': 'CO', 'chile': 'CL', 'peru': 'PE', 'ecuador': 'EC',
  'uruguay': 'UY', 'venezuela': 'VE', 'costa rica': 'CR', 'panama': 'PA',
  // Asia-Pacific
  'australia': 'AU', 'new zealand': 'NZ', 'japan': 'JP', 'china': 'CN',
  'india': 'IN', 'singapore': 'SG', 'south korea': 'KR', 'korea': 'KR',
  'taiwan': 'TW', 'hong kong': 'HK', 'thailand': 'TH', 'vietnam': 'VN',
  'indonesia': 'ID', 'malaysia': 'MY', 'philippines': 'PH', 'pakistan': 'PK',
  'bangladesh': 'BD', 'nepal': 'NP', 'sri lanka': 'LK',
  // Middle East & Africa
  'israel': 'IL', 'united arab emirates': 'AE', 'uae': 'AE',
  'saudi arabia': 'SA', 'egypt': 'EG', 'south africa': 'ZA',
  'nigeria': 'NG', 'kenya': 'KE', 'ethiopia': 'ET', 'ghana': 'GH',
  'morocco': 'MA', 'tunisia': 'TN', 'jordan': 'JO', 'lebanon': 'LB',
  'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
};

function resolveCountryCode(countryName: string | undefined): string | null {
  if (!countryName) return null;
  return COUNTRY_ISO[countryName.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfsItem {
  name: string;
  url?: string;
  startDate: string;
  endDate?: string;
  city?: string;
  country?: string;
  online?: boolean;
  locales?: string;
  cfpUrl?: string;
  twitter?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSourceId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/-$/, '');
  return `ct-${slug}`;
}

function buildDescription(conf: ConfsItem, topic: string): string {
  const parts: string[] = [];

  if (conf.online) {
    parts.push('Online tech conference — open to participants worldwide.');
  } else if (conf.city && conf.country) {
    parts.push(`Tech conference in ${conf.city}, ${conf.country}.`);
  } else if (conf.city) {
    parts.push(`Tech conference in ${conf.city}.`);
  } else {
    parts.push('Tech conference.');
  }

  const topicLabel = topic === 'general' ? 'technology' : topic;
  parts.push(`Topic: ${topicLabel}.`);

  if (conf.locales && conf.locales !== 'EN') {
    parts.push(`Language: ${conf.locales}.`);
  }

  if (conf.cfpUrl) {
    parts.push('Call for papers open — speakers welcome to submit talks.');
  }

  if (conf.url) parts.push(`More info: ${conf.url}`);

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchTopicConferences(year: number, topic: string): Promise<ConfsItem[]> {
  const url = `${RAW_BASE}/${year}/${topic}.json`;
  try {
    const res = await fetchWithRetry(url, {
      timeoutMs: 10000,
      headers: { 'Accept': 'application/json' },
      logTag: '[ConfsTech]',
      retries: 2,
    });
    if (!res.ok) return [];
    return await res.json() as ConfsItem[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importConfsTechOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[ConfsTech] Starting conference import...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    // Fetch current year + next year to capture upcoming conferences
    const currentYear = now.getFullYear();
    const years = [currentYear, currentYear + 1];

    // Collect all conferences, deduped by name (same conf in multiple topic files)
    const confsByName = new Map<string, { conf: ConfsItem; topics: string[] }>();

    for (const year of years) {
      for (const topic of TOPICS) {
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
        const items = await fetchTopicConferences(year, topic);

        for (const conf of items) {
          if (!conf.name) continue;
          const key = conf.name.toLowerCase().trim();
          const existing = confsByName.get(key);
          if (existing) {
            if (!existing.topics.includes(topic)) existing.topics.push(topic);
          } else {
            confsByName.set(key, { conf, topics: [topic] });
          }
        }
      }
    }

    logger.info(`[ConfsTech] Fetched ${confsByName.size} unique conferences`);

    // Filter to upcoming only (endDate or startDate >= 7 days ago)
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const upcoming = Array.from(confsByName.values()).filter(({ conf }) => {
      const endStr = conf.endDate ?? conf.startDate;
      if (!endStr) return false;
      const end = new Date(endStr);
      return !isNaN(end.getTime()) && end >= cutoff;
    });

    logger.info(`[ConfsTech] ${upcoming.length} upcoming/recent conferences`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];
    const batchIds = new Set<string>();

    for (const { conf, topics } of upcoming) {
      try {
        const sid = buildSourceId(conf.name);
        if (batchIds.has(sid)) continue;
        batchIds.add(sid);

        const startDate = conf.startDate ? new Date(conf.startDate) : null;
        const endDate = conf.endDate ? new Date(conf.endDate) : startDate;
        if (!startDate || isNaN(startDate.getTime())) { skipped++; continue; }

        const durationMs = endDate && startDate ? endDate.getTime() - startDate.getTime() : 0;
        const durationDays = durationMs > 0 ? Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24))) : 1;

        const isRemote = conf.online === true;
        const country = resolveCountryCode(conf.country);
        const isAbroad = !isRemote && !!country && country !== 'IT';

        // Merge eligible fields from all topics this conference appeared in
        const eligibleFields = Array.from(
          new Set(topics.flatMap(t => TOPIC_FIELDS[t] ?? [])),
        ) as FieldOfStudy[];

        // Primary topic = first one (determines description label)
        const primaryTopic = topics[0];
        const title = conf.name.slice(0, 250);
        const description = buildDescription(conf, primaryTopic);

        const v = validateOpportunity({
          title,
          description,
          company: null,
          url: conf.url ?? null,
          location: isRemote ? 'Online' : conf.city ? `${conf.city}${conf.country ? `, ${conf.country}` : ''}` : null,
          isAbroad,
          isRemote,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          city: conf.city ?? null,
          country,
          cost: 0,
          hasScholarship: false,
          eligibleFields,
          verified: false,
        }, SOURCE_KEY);

        if (!v) { skipped++; continue; }

        const tags = ['conference', ...topics.slice(0, 4)];
        if (isRemote) tags.push('online');

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: null,
          url: conf.url ?? null,
          location: isRemote ? 'Online' : conf.city ? `${conf.city}${conf.country ? `, ${conf.country}` : ''}` : null,
          isAbroad,
          isRemote,
          type: 'CONFERENCE',
          tags,
          postedAt: startDate,
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          city: conf.city ?? null,
          country,
          cost: 0,
          hasScholarship: false,
          eligibleFields,
          verified: false,
        });
      } catch (err) {
        logger.warn(`[ConfsTech] Error processing "${conf.name?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    // Enrich descriptions with conference website meta descriptions.
    // Concurrency=3 to speed up without hammering individual sites.
    const toEnrich = records.filter(r => r.url).slice(0, META_ENRICH_LIMIT);
    let enriched = 0;
    await runWithConcurrency(toEnrich, 3, async (record) => {
      const meta = await fetchMetaDescription(record.url!);
      if (meta && meta.length > record.description.length) {
        record.description = meta.slice(0, 2000);
        enriched++;
      }
    });
    if (enriched > 0) logger.info(`[ConfsTech] Enriched ${enriched} descriptions from conference websites`);

    await batchUpsertOpportunities(records);

    const seenIds = records.map(r => r.id);
    await markStaleOpportunities(SOURCE_KEY, seenIds, { minSeenForStale: 10 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: records.length,
        finishedAt: new Date(),
        metadata: { skipped, totalUnique: confsByName.size, upcoming: upcoming.length },
      },
    });

    logger.info(`[ConfsTech] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[ConfsTech] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
