/**
 * European Youth Portal — Opportunity Import via REST/Elasticsearch API
 * Source: https://youth.europa.eu/go-abroad/volunteering/opportunities_en
 *
 * The European Youth Portal (EYP) hosts opportunities from the European
 * Solidarity Corps (ESC) — volunteering, traineeships, and solidarity projects.
 *
 * API: GET https://youth.europa.eu/api/rest/eyp/v1/search_en
 *   ?type=Opportunity&size=N&from=OFFSET
 *   &filters[status]=open
 *   &filters[date_end][operator]=>=&filters[date_end][value]=YYYY-MM-DD
 *   &sort[created]=desc
 *
 * Data is published under CC BY 4.0 — attribution required.
 *
 * Runs weekly on Monday at 03:30 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://youth.europa.eu/api/rest/eyp/v1/search_en';
const PAGE_SIZE = 50;
const MAX_RESULTS = 1200;
const FETCH_DELAY_MS = 500;

// Funding programme IDs (1-8 cover ESC + Erasmus+ volunteering/solidarity)
const FUNDING_IDS = ['5', '4', '3', '2', '1', '8', '6', '7'];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function buildSearchUrl(from: number, size: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams();

  params.set('type', 'Opportunity');
  params.set('size', String(size));
  params.set('from', String(from));

  // Only open opportunities with end date >= today
  params.set('filters[status]', 'open');
  params.set('filters[date_end][operator]', '>=');
  params.set('filters[date_end][value]', today);
  params.set('filters[date_end][type]', 'must');

  // Funding programmes
  FUNDING_IDS.forEach((id, i) => {
    params.set(`filters[funding_programme][id][${i}]`, id);
  });

  // Deadline filter: include opportunities where deadline >= today OR no deadline
  params.set('filters[date_application_end][operator]', '>=');
  params.set('filters[date_application_end][value]', today);
  params.set('filters[date_application_end][type]', 'must');
  params.set('filters[date_application_end][group]', 'deadline');
  params.set('filters[has_no_deadline][value]', 'true');
  params.set('filters[has_no_deadline][type]', 'must');
  params.set('filters[has_no_deadline][group]', 'deadline');

  // Sort by newest first
  params.set('sort[created]', 'desc');

  return `${API_BASE}?${params.toString()}`;
}

interface EYPHit {
  _id: string;
  _source: {
    opid: number;
    title: string;
    description?: string;
    organisation_name?: string;
    town?: string;
    country?: string;
    date_start?: string;
    date_end?: string;
    date_application_end?: string;
    has_no_deadline?: boolean;
    duration?: number;
    volunteer_activity_type?: string;
    participant_profile?: string;
    boarding_arrangements?: string;
    training?: string;
    contact_person_email?: string;
    status?: string;
    created?: string;
    esc_topics?: string[];
    funding_programme?: {
      id: number;
      activity_types?: string[];
    };
  };
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

function mapType(hit: EYPHit['_source']): OpportunityType {
  const activityTypes = hit.funding_programme?.activity_types || [];
  const title = (hit.title || '').toLowerCase();

  if (activityTypes.includes('volunteering') || title.includes('volunt')) return 'EXTRACURRICULAR';
  if (activityTypes.includes('traineeship') || title.includes('trainee') || title.includes('stage')) return 'STAGE';
  if (activityTypes.includes('solidarity') || title.includes('solidarity')) return 'EXTRACURRICULAR';
  if (title.includes('internship') || title.includes('tirocinio')) return 'INTERNSHIP';
  return 'EXTRACURRICULAR'; // ESC is primarily volunteering/solidarity
}

function cleanText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\r\\n|\\r|\\n/g, '\n')
    .replace(/\r\n|\r/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importEUOpportunities(options?: {
  maxResults?: number;
}): Promise<{ imported: number; skipped: number; sources: string[] }> {
  logger.info('[EU Youth] Starting import from European Youth Portal API...');
  const now = new Date();
  const maxResults = options?.maxResults || MAX_RESULTS;

  const log = await prisma.importLog.create({
    data: { source: 'eu-youth', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let imported = 0;
    let skipped = 0;
    let from = 0;
    let totalAvailable = 0;

    while (from < maxResults) {
      const size = Math.min(PAGE_SIZE, maxResults - from);
      const url = buildSearchUrl(from, size);
      logger.info(`[EU Youth] Fetching opportunities ${from + 1}-${from + size}...`);

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          logger.warn(`[EU Youth] API returned ${res.status}`);
          break;
        }

        const data = await res.json() as {
          hits: { total: { value: number }; hits: EYPHit[] };
        };

        totalAvailable = data.hits.total.value;
        const hits = data.hits.hits;

        if (hits.length === 0) {
          logger.info(`[EU Youth] No more results at offset ${from}`);
          break;
        }

        for (const hit of hits) {
          const s = hit._source;
          const sid = `eyp-${s.opid}`;

          // Build description from available fields
          const descParts = [
            cleanText(s.description),
            s.participant_profile ? `\nProfilo richiesto:\n${cleanText(s.participant_profile)}` : '',
            s.boarding_arrangements ? `\nAlloggio:\n${cleanText(s.boarding_arrangements)}` : '',
            s.training ? `\nFormazione:\n${cleanText(s.training)}` : '',
          ].filter(Boolean);
          const fullDescription = descParts.join('\n') || s.title;

          const location = [s.town, s.country].filter(Boolean).join(', ');
          const isAbroad = s.country !== 'IT';

          // Parse deadline
          let deadline: Date | null = null;
          if (s.date_application_end && !s.has_no_deadline) {
            const d = new Date(s.date_application_end);
            if (!isNaN(d.getTime())) deadline = d;
          }

          // Parse expiry (end date of the opportunity)
          let expiresAt: Date | null = null;
          if (s.date_end) {
            const d = new Date(s.date_end);
            if (!isNaN(d.getTime())) expiresAt = d;
          }

          const detailUrl = `https://youth.europa.eu/solidarity/placement/${s.opid}_en`;

          const validated = validateOpportunity({
            title: s.title,
            description: fullDescription,
            company: s.organisation_name || null,
            url: detailUrl,
            location,
            isAbroad,
            isRemote: false,
            expiresAt,
          }, 'eu-youth');

          if (!validated) { skipped++; continue; }

          // Tags from ESC topics
          const tags = (s.esc_topics || []).slice(0, 5);
          if (s.volunteer_activity_type) tags.push(s.volunteer_activity_type);

          await prisma.opportunity.upsert({
            where: { id: sid },
            update: {
              title: validated.title,
              description: validated.description,
              company: validated.company,
              url: validated.url,
              location: validated.location,
              isAbroad: validated.isAbroad,
              isRemote: false,
              type: mapType(s),
              tags,
              deadline,
              expiresAt,
              source: 'Portale Europeo Giovani',
              sourceId: sid,
              lastSyncedAt: now,
            },
            create: {
              id: sid,
              title: validated.title,
              description: validated.description,
              company: validated.company,
              url: validated.url,
              location: validated.location,
              isAbroad: validated.isAbroad,
              isRemote: false,
              type: mapType(s),
              tags,
              deadline,
              expiresAt,
              postedAt: s.created ? new Date(s.created) : now,
              source: 'Portale Europeo Giovani',
              sourceId: sid,
              lastSyncedAt: now,
            },
          });
          imported++;
        }

        from += hits.length;
        await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      } catch (err) {
        logger.warn(`[EU Youth] Fetch failed at offset ${from}: ${err}`);
        break;
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, totalAvailable, fetched: from },
      },
    });

    logger.info(`[EU Youth] Imported ${imported}, skipped ${skipped} (${totalAvailable} available)`);
    return { imported, skipped, sources: ['European Youth Portal'] };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[EU Youth] Import failed: ${err}`);
    return { imported: 0, skipped: 0, sources: [] };
  }
}
