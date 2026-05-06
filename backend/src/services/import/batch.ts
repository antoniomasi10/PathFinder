/**
 * Batch-write + mark-stale helpers for opportunity imports.
 *
 * - batchUpsertOpportunities: splits records into inserts (createMany) and
 *   updates (transaction of update() calls). Replaces N individual upserts,
 *   cutting DB round-trips by ~10x on a typical 500-row run.
 *
 * - markStaleOpportunities: sets expiresAt=now on opportunities of a given
 *   source that were NOT seen in this run, scoped to the successful boards.
 *   The weekly cleanup job deletes rows with expiresAt < now, so expired
 *   postings disappear from users' feeds within a week.
 */
import { FieldOfStudy, OpportunityFormat, OpportunityType } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { buildDedupKey } from './utils';

export interface OpportunityRecord {
  id: string;
  title: string;
  description: string;
  company: string | null;
  url: string | null;
  location: string | null;
  isAbroad: boolean;
  isRemote: boolean;
  type: OpportunityType;
  tags: string[];
  postedAt: Date;
  expiresAt?: Date | null;
  deadline?: Date | null;
  source: string;
  sourceId: string;
  lastSyncedAt: Date;
  // event/experience fields (all optional — existing importers leave undefined)
  organizer?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  durationDays?: number | null;
  format?: OpportunityFormat | null;
  city?: string | null;
  country?: string | null;
  cost?: number | null;
  hasScholarship?: boolean;
  scholarshipDetails?: string | null;
  stipend?: number | null;
  eligibleFields?: FieldOfStudy[];
  minYearOfStudy?: number | null;
  maxYearOfStudy?: number | null;
  requiredLanguages?: object[];
  verified?: boolean;
}

const UPDATE_CHUNK_SIZE = 100;

/**
 * Upserts opportunities in batches. `postedAt` is preserved on updates
 * (only set on inserts) so we don't rewrite the original publication date.
 */
export async function batchUpsertOpportunities(records: OpportunityRecord[]): Promise<void> {
  if (records.length === 0) return;

  // Attach dedup key to each record so updates also refresh it on older rows.
  const enriched = records.map(r => ({ ...r, dedupKey: buildDedupKey(r.title, r.company ?? r.organizer) }));

  const ids = enriched.map(r => r.id);
  const existing = new Set(
    (await prisma.opportunity.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })).map(r => r.id),
  );

  // Cross-source dedup: among records we're about to insert, look up whether
  // any other source already has a row with the same dedupKey. If so, skip
  // the insert — the existing row "wins". Updates (same id) are never skipped.
  const candidateKeys = enriched
    .filter(r => !existing.has(r.id) && r.dedupKey)
    .map(r => r.dedupKey as string);
  const dupKeySet = new Set<string>();
  if (candidateKeys.length > 0) {
    const hits = await prisma.opportunity.findMany({
      where: { dedupKey: { in: candidateKeys }, id: { notIn: ids } },
      select: { dedupKey: true },
    });
    for (const h of hits) if (h.dedupKey) dupKeySet.add(h.dedupKey);
  }

  // Also dedup within this batch: if two different sources surface the same
  // posting in the same run, keep only the first.
  const batchKeys = new Set<string>();
  let crossSourceSkipped = 0;
  const toCreate: typeof enriched = [];
  const toUpdate: typeof enriched = [];
  for (const r of enriched) {
    if (existing.has(r.id)) { toUpdate.push(r); continue; }
    if (r.dedupKey) {
      if (dupKeySet.has(r.dedupKey) || batchKeys.has(r.dedupKey)) {
        crossSourceSkipped++;
        continue;
      }
      batchKeys.add(r.dedupKey);
    }
    toCreate.push(r);
  }
  if (crossSourceSkipped > 0) {
    logger.info(`[BatchUpsert] Skipped ${crossSourceSkipped} cross-source duplicates`);
  }

  if (toCreate.length > 0) {
    await prisma.opportunity.createMany({
      data: toCreate.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        company: r.company,
        url: r.url,
        location: r.location,
        isAbroad: r.isAbroad,
        isRemote: r.isRemote,
        type: r.type,
        tags: r.tags,
        postedAt: r.postedAt,
        expiresAt: r.expiresAt ?? null,
        deadline: r.deadline ?? null,
        source: r.source,
        sourceId: r.sourceId,
        lastSyncedAt: r.lastSyncedAt,
        dedupKey: r.dedupKey,
        organizer: r.organizer ?? null,
        startDate: r.startDate ?? null,
        endDate: r.endDate ?? null,
        durationDays: r.durationDays ?? null,
        format: r.format ?? null,
        city: r.city ?? null,
        country: r.country ?? null,
        cost: r.cost ?? null,
        hasScholarship: r.hasScholarship ?? false,
        scholarshipDetails: r.scholarshipDetails ?? null,
        stipend: r.stipend ?? null,
        eligibleFields: r.eligibleFields ?? [],
        minYearOfStudy: r.minYearOfStudy ?? null,
        maxYearOfStudy: r.maxYearOfStudy ?? null,
        requiredLanguages: r.requiredLanguages ?? [],
        verified: r.verified ?? false,
      })),
      skipDuplicates: true,
    });
  }

  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map(r =>
        prisma.opportunity.update({
          where: { id: r.id },
          data: {
            title: r.title,
            description: r.description,
            company: r.company,
            url: r.url,
            location: r.location,
            isAbroad: r.isAbroad,
            isRemote: r.isRemote,
            type: r.type,
            tags: r.tags,
            expiresAt: r.expiresAt ?? null,
            deadline: r.deadline ?? null,
            source: r.source,
            sourceId: r.sourceId,
            lastSyncedAt: r.lastSyncedAt,
            dedupKey: r.dedupKey,
            organizer: r.organizer ?? null,
            startDate: r.startDate ?? null,
            endDate: r.endDate ?? null,
            durationDays: r.durationDays ?? null,
            format: r.format ?? null,
            city: r.city ?? null,
            country: r.country ?? null,
            cost: r.cost ?? null,
            hasScholarship: r.hasScholarship ?? false,
            scholarshipDetails: r.scholarshipDetails ?? null,
            stipend: r.stipend ?? null,
            eligibleFields: r.eligibleFields ?? [],
            minYearOfStudy: r.minYearOfStudy ?? null,
            maxYearOfStudy: r.maxYearOfStudy ?? null,
            requiredLanguages: r.requiredLanguages ?? [],
            verified: r.verified ?? false,
          },
        }),
      ),
    );
  }
}

/**
 * Marks opportunities of `source` as expired when they were not seen in the
 * current run. Safety: only affects rows whose `company` is in `scopeCompanies`
 * (or runs unscoped if omitted — only do that for aggregators without boards).
 * Skips rows with an explicit expiresAt (source-declared expiry wins).
 */
export async function markStaleOpportunities(
  source: string,
  seenIds: string[],
  options: { scopeCompanies?: string[]; minSeenForStale?: number } = {},
): Promise<number> {
  const min = options.minSeenForStale ?? 1;
  if (seenIds.length < min) {
    logger.warn(`[MarkStale] ${source}: only ${seenIds.length} seen (min=${min}) — skipping to avoid mass-expiry`);
    return 0;
  }

  const where: any = {
    source,
    id: { notIn: seenIds },
    expiresAt: null,
  };
  if (options.scopeCompanies && options.scopeCompanies.length > 0) {
    where.company = { in: options.scopeCompanies };
  }

  const result = await prisma.opportunity.updateMany({
    where,
    data: { expiresAt: new Date() },
  });

  if (result.count > 0) {
    logger.info(`[MarkStale] ${source}: expired ${result.count} opportunities no longer on source`);
  }
  return result.count;
}
