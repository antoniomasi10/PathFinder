/**
 * Generic ATS connector factory.
 *
 * Replaces the near-identical per-ATS import files (greenhouse/lever/ashby/
 * workable/…) with a single orchestrator parameterized by an `AtsAdapter`.
 * Board tokens come from the DB registry (`CompanyWatchlist.atsType/atsToken`)
 * merged with the adapter's curated seed and any manual override, so companies
 * found by discovery flow into the cheap ATS path with no new code.
 *
 * Pipeline (identical to the old hand-written connectors):
 *   fetch board → parseJobs → filter student roles → validate → OpportunityRecord
 *   → batchUpsertOpportunities (dedup + AI enrich) → markStaleOpportunities.
 */
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { validateOpportunity } from '../validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from '../batch';
import { extractCountryCode, mapOpportunityType, fetchWithRetry, runWithConcurrency } from '../utils';
import { getRegistryBoards } from './registry';
import { AtsAdapter, AtsJob } from './types';

const DEFAULT_CONCURRENCY = 4;
const FETCH_DELAY_MS = 300;

/** Matches student/intern/junior titles across EN/IT/FR/DE/ES. */
const STUDENT_RE = /\b(intern(?:ship)?|stage|stagiaire|tirocinio|trainee(?:ship)?|graduate|apprenti(?:ce)?|apprenticeship|werkstudent|alternance|co-op|praktik(?:um|ant)|junior|student)\b/i;

/** True if a title looks student-relevant. Guards against "internal" false positives. */
export function isStudentRole(title: string): boolean {
  const t = title.toLowerCase();
  if (t.includes('internal')) return false; // "Internal Audit", "Internal Comms"
  return STUDENT_RE.test(t);
}

export async function runAtsConnector(
  adapter: AtsAdapter,
  options?: { boards?: Record<string, string>; concurrency?: number },
): Promise<{ imported: number; skipped: number; source: string }> {
  const tag = `[${adapter.sourceLabel}]`;
  logger.info(`${tag} Starting opportunity import...`);
  const now = new Date();

  // Merge: adapter seed < manual override < DB registry (discovery-grown).
  const boards: Record<string, string> = {
    ...(adapter.seedBoards || {}),
    ...(options?.boards || {}),
    ...(await getRegistryBoards(adapter.platform)),
  };
  const totalBoards = Object.keys(boards).length;

  const log = await prisma.importLog.create({
    data: { source: adapter.platform, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    let skipped = 0;
    let boardsProcessed = 0;
    const records: OpportunityRecord[] = [];
    const seenIds: string[] = [];
    const successfulCompanies: string[] = [];

    await runWithConcurrency(
      Object.entries(boards),
      options?.concurrency ?? DEFAULT_CONCURRENCY,
      async ([token, companyName]) => {
        try {
          const res = await fetchWithRetry(adapter.buildUrl(token), {
            timeoutMs: adapter.timeoutMs ?? 15000,
            headers: { Accept: 'application/json' },
            logTag: `${tag} ${companyName}`,
          });
          if (!res.ok) {
            logger.warn(`${tag} ${companyName} returned ${res.status}`);
            return;
          }

          const raw = await res.json();
          let jobs: AtsJob[];
          try {
            jobs = adapter.parseJobs(raw, { token, companyName });
          } catch (e) {
            logger.warn(`${tag} ${companyName} parse failed: ${e}`);
            return;
          }

          for (const job of jobs) {
            if (!isStudentRole(job.title)) continue;

            const sid = `${adapter.platform}-${token}-${String(job.externalId).slice(0, 40)}`;
            const countryCode = job.countryCode || extractCountryCode(job.location);
            const isAbroad = countryCode !== 'IT';
            const isRemote = job.isRemote ?? job.location.toLowerCase().includes('remote');

            const validated = validateOpportunity({
              title: `${job.title} — ${companyName}`,
              description: job.description || `${job.title} at ${companyName}`,
              company: companyName,
              url: job.url,
              location: job.location,
              isAbroad,
              isRemote,
              expiresAt: null,
            }, adapter.platform);

            if (!validated) { skipped++; continue; }

            seenIds.push(sid);
            records.push({
              id: sid,
              title: validated.title,
              description: validated.description,
              company: validated.company || companyName,
              url: validated.url ?? null,
              location: validated.location || null,
              isAbroad: validated.isAbroad,
              isRemote: validated.isRemote,
              type: mapOpportunityType(job.title),
              tags: job.tags.slice(0, 5),
              postedAt: job.postedAt || now,
              source: adapter.sourceLabel,
              sourceId: sid,
              lastSyncedAt: now,
            });
          }

          boardsProcessed++;
          successfulCompanies.push(companyName);
          await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
        } catch (err) {
          logger.warn(`${tag} ${companyName} failed: ${err}`);
        }
      },
    );

    await batchUpsertOpportunities(records);
    const imported = records.length;

    const staleCount = successfulCompanies.length > 0
      ? await markStaleOpportunities(adapter.sourceLabel, seenIds, { scopeCompanies: successfulCompanies })
      : 0;

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: imported,
        finishedAt: new Date(),
        metadata: { skipped, boardsProcessed, totalBoards, staleCount },
      },
    });

    logger.info(`${tag} Imported ${imported}, skipped ${skipped}, expired ${staleCount} from ${boardsProcessed} boards`);
    return { imported, skipped, source: adapter.platform };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`${tag} Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
