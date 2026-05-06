/**
 * SmartRecruiters — Public Posting API Import
 * Source: https://developers.smartrecruiters.com/docs/posting-api
 *
 * SmartRecruiters is an ATS used by many enterprise companies (Bosch, Visa,
 * Continental, SIXT, Roland Berger, etc.). Their Posting API is public (no
 * auth required). We query multiple company boards with student/intern
 * search terms and filter results for intern/stage/trainee/praktikum/
 * werkstudent roles relevant to university students.
 *
 * Replaces Bundesagentur (German market) and partially The Muse (enterprise
 * non-tech companies).
 *
 * List API:   GET https://api.smartrecruiters.com/v1/companies/{id}/postings?q={term}
 * Detail API: GET https://api.smartrecruiters.com/v1/companies/{id}/postings/{postingId}
 *
 * Runs weekly on Monday at 04:00 via scheduler.ts.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { OpportunityType } from '@prisma/client';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { stripHtml, mapOpportunityType, fetchWithRetry, runWithConcurrency } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.smartrecruiters.com/v1/companies';
const FETCH_DELAY_MS = 400;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_QUERY = 5;
const BOARD_CONCURRENCY = 3;

/** Search terms passed as `q=` param — broad net, filtered by title regex below.
 *  Kept to 4 core terms: overlap between queries causes most postings to surface
 *  multiple times, so extra queries waste bandwidth without adding coverage. */
const SEARCH_QUERIES = [
  'intern',
  'trainee',
  'praktikum',
  'stage',
];

/** Regex matching student/intern titles (word boundary to avoid false positives like "internal") */
const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|tirocinio|trainee|praktikum|praktikant|werkstudent|apprenti(?:ce)?|alternance|duales\s*studium|co-op|graduate\s*(?:program|scheme)?)\b/i;

/**
 * Company identifiers on SmartRecruiters. Curated for high intern yield and
 * brand recognition. Focus on filling gaps left by Bundesagentur (German
 * industrial) and The Muse (enterprise non-tech).
 * identifier → display name
 */
const BOARDS: Record<string, string> = {
  // German industrial — fills Bundesagentur gap
  'BoschGroup': 'Bosch Group',
  'Continental': 'Continental',
  'SIXT': 'SIXT',
  'ENERTRAG': 'ENERTRAG',
  // Enterprise / consulting — fills The Muse gap
  'Visa': 'Visa',
  'RolandBerger': 'Roland Berger',
  'PAConsulting': 'PA Consulting',
  'ServiceNow': 'ServiceNow',
  'Experian': 'Experian',
  'Devoteam': 'Devoteam',
  'TheNielsenCompany': 'Nielsen',
  'Sodexo': 'Sodexo',
  'Equinox': 'Equinox',
  // Research / international organizations
  'CERN': 'CERN',
  'OECD': 'OECD',
  // Other EU-relevant
  'bew': 'Berliner Energie und Wärme',
  'EssilorLuxottica': 'EssilorLuxottica',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStudentRole(title: string): boolean {
  return STUDENT_RE.test(title);
}

const mapType = mapOpportunityType;

/** Build a human-readable location string from the structured location object */
function formatLocation(loc: SRLocation | undefined): string {
  if (!loc) return '';
  if (loc.fullLocation) return loc.fullLocation;
  const parts = [loc.city, loc.region, loc.country?.toUpperCase()].filter(Boolean);
  return parts.join(', ');
}

/** True if the job is located or hirable from Italy */
function isItalianLocation(loc: SRLocation | undefined): boolean {
  if (!loc) return false;
  if (loc.country?.toLowerCase() === 'it') return true;
  const full = (loc.fullLocation || '').toLowerCase();
  return full.includes('italy') || full.includes('italia');
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface SRLocation {
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  hybrid?: boolean;
  fullLocation?: string;
}

interface SRPosting {
  id: string;
  name: string;
  uuid: string;
  refNumber?: string;
  company: { identifier: string; name: string };
  location?: SRLocation;
  releasedDate?: string;
  industry?: { label: string };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { id?: string; label?: string };
}

interface SRListResponse {
  offset: number;
  limit: number;
  totalFound: number;
  content: SRPosting[];
}

interface SRJobAdSection {
  text?: string;
}

interface SRDetailResponse {
  id: string;
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: {
    sections?: {
      companyDescription?: SRJobAdSection;
      jobDescription?: SRJobAdSection;
      qualifications?: SRJobAdSection;
      additionalInformation?: SRJobAdSection;
    };
  };
}

// ---------------------------------------------------------------------------
// Import orchestration
// ---------------------------------------------------------------------------

export async function importSmartRecruitersOpportunities(options?: {
  boards?: Record<string, string>;
}): Promise<{ imported: number; skipped: number; source: string }> {
  logger.info('[SmartRecruiters] Starting opportunity import...');
  const now = new Date();
  const boards = options?.boards || BOARDS;

  const log = await prisma.importLog.create({
    data: { source: 'smartrecruiters', type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let boardsProcessed = 0;
    const seenPostingIds = new Set<string>();
    const records: OpportunityRecord[] = [];
    const seenSids: string[] = [];
    const successfulCompanies: string[] = [];

    await runWithConcurrency(Object.entries(boards), BOARD_CONCURRENCY, async ([companyId, companyName]) => {
      try {
        logger.info(`[SmartRecruiters] Processing ${companyName} (${companyId})...`);
        let boardJobs = 0;

        for (const query of SEARCH_QUERIES) {
          let offset = 0;
          for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
            const listUrl = `${API_BASE}/${encodeURIComponent(companyId)}/postings?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`;

            const res = await fetchWithRetry(listUrl, {
              timeoutMs: 15000,
              headers: { 'Accept': 'application/json' },
              retries: 4,
              maxBackoffMs: 60000,
              logTag: `[SmartRecruiters] ${companyName} q="${query}"`,
            });

            if (!res.ok) {
              logger.warn(`[SmartRecruiters] ${companyName} q="${query}" returned ${res.status}`);
              break;
            }

            const body = await res.json() as SRListResponse;
            const jobs = body.content || [];
            if (jobs.length === 0) break;

            // Filter for student/intern roles by title
            const studentJobs = jobs.filter(j => isStudentRole(j.name));

            for (const job of studentJobs) {
              if (seenPostingIds.has(job.id)) { skipped++; continue; }
              seenPostingIds.add(job.id);

              // Fetch detail for description + applyUrl
              let description = `${job.name} at ${companyName}`;
              let jobUrl: string | null = null;
              try {
                const detailUrl = `${API_BASE}/${encodeURIComponent(companyId)}/postings/${encodeURIComponent(job.id)}`;
                const detailRes = await fetchWithRetry(detailUrl, {
                  timeoutMs: 15000,
                  headers: { 'Accept': 'application/json' },
                  retries: 2,
                  logTag: `[SmartRecruiters] ${companyName} detail`,
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json() as SRDetailResponse;
                  jobUrl = detail.applyUrl || detail.postingUrl || null;
                  const s = detail.jobAd?.sections;
                  const composed = [
                    stripHtml(s?.companyDescription?.text || ''),
                    stripHtml(s?.jobDescription?.text || ''),
                    stripHtml(s?.qualifications?.text || ''),
                    stripHtml(s?.additionalInformation?.text || ''),
                  ].filter(Boolean).join('\n\n');
                  if (composed.length >= 10) {
                    description = composed.slice(0, 10000);
                  }
                }
              } catch {
                // Use fallback description
              }

              if (!jobUrl) {
                jobUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(companyId)}/${encodeURIComponent(job.id)}`;
              }

              const location = formatLocation(job.location);
              const isAbroad = !isItalianLocation(job.location);
              const isRemote = !!job.location?.remote;

              const tags = [
                job.industry?.label,
                job.function?.label,
                job.location?.country?.toUpperCase(),
              ].filter((t): t is string => !!t).slice(0, 5);

              const validated = validateOpportunity({
                title: `${job.name} — ${companyName}`,
                description,
                company: companyName,
                url: jobUrl,
                location,
                isAbroad,
                isRemote,
                expiresAt: null,
              }, 'smartrecruiters');

              if (!validated) { skipped++; continue; }

              const sid = `smartrecruiters-${companyId}-${job.id}`;
              seenSids.push(sid);
              records.push({
                id: sid,
                title: validated.title,
                description: validated.description,
                company: validated.company || companyName,
                url: validated.url ?? null,
                location: validated.location || null,
                isAbroad: validated.isAbroad,
                isRemote: validated.isRemote,
                type: mapType(job.name),
                tags,
                postedAt: job.releasedDate ? new Date(job.releasedDate) : now,
                source: 'SmartRecruiters',
                sourceId: sid,
                lastSyncedAt: now,
              });
              boardJobs++;

              await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
            }

            offset += PAGE_SIZE;
            if (offset >= body.totalFound) break;
            await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
          }
        }

        logger.info(`[SmartRecruiters] ${companyName}: +${boardJobs} jobs`);
        boardsProcessed++;
        successfulCompanies.push(companyName);
      } catch (err) {
        logger.warn(`[SmartRecruiters] ${companyName} failed: ${err}`);
      }
    });

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = successfulCompanies.length > 0
      ? await markStaleOpportunities('SmartRecruiters', seenSids, { scopeCompanies: successfulCompanies })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, boardsProcessed, totalBoards: Object.keys(boards).length, staleCount },
      },
    });

    logger.info(`[SmartRecruiters] Imported ${imported}, skipped ${skipped}, expired ${staleCount} from ${boardsProcessed} boards`);
    return { imported, skipped, source: 'smartrecruiters' };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[SmartRecruiters] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
