/**
 * Data Cleanup Service
 *
 * Retention policy:
 * - Opportunities: delete ONLY if explicitly expired (expiresAt < now).
 *   Rows with a past endDate (event/hackathon finished) or deadline
 *   (applications closed) but no expiresAt yet get expiresAt=now stamped
 *   here, so they're deleted on the *next* cleanup run.
 *   Stale records (not synced recently) stay visible — they may still
 *   be live on the source site. They just get flagged for re-verification.
 * - Universities/Courses: soft-delete (isActive=false) if not synced in 12 months
 * - ImportLog: prune entries older than 90 days
 *
 * Manual/seed records (sourceId=null) are NEVER auto-deleted.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const DAYS_MS = 24 * 60 * 60 * 1000;

interface CleanupResult {
  expiredOpportunities: number;
  deduplicatedOpportunities: number;
  flaggedStaleOpportunities: number;
  deactivatedUniversities: number;
  deactivatedCourses: number;
  prunedLogs: number;
}

/**
 * Sets expiresAt=now on rows whose endDate (event/hackathon finished) or
 * deadline (applications closed) has passed but that don't have an explicit
 * expiresAt yet. Extracted from runCleanup so it's independently testable —
 * the actual delete of expired rows happens on the next cleanup run.
 */
export async function expireByDate(now: Date): Promise<number> {
  const result = await prisma.opportunity.updateMany({
    where: {
      sourceId: { not: null },
      expiresAt: null,
      OR: [
        { endDate: { not: null, lt: now } },
        { deadline: { not: null, lt: now } },
      ],
    },
    data: { expiresAt: now },
  });
  return result.count;
}

export async function runCleanup(): Promise<CleanupResult> {
  logger.info('[Cleanup] Starting data cleanup...');
  const now = new Date();
  const result: CleanupResult = {
    expiredOpportunities: 0,
    deduplicatedOpportunities: 0,
    flaggedStaleOpportunities: 0,
    deactivatedUniversities: 0,
    deactivatedCourses: 0,
    prunedLogs: 0,
  };

  // 0. Remove cross-source duplicates (same title+company+startDate, keep most
  //    recent). startDate is part of the grouping so recurring events/hackathons
  //    on different dates are never collapsed into one row.
  const dupeGroups = await prisma.$queryRawUnsafe<{ ids: string[] }[]>(`
    SELECT array_agg(id ORDER BY "postedAt" DESC) as ids
    FROM "Opportunity"
    GROUP BY LOWER(title), LOWER(company), COALESCE("startDate", '1900-01-01'::timestamp)
    HAVING COUNT(*) > 1
  `);
  if (dupeGroups.length > 0) {
    const idsToDelete = dupeGroups.flatMap(g => g.ids.slice(1));
    if (idsToDelete.length > 0) {
      const deleted = await prisma.opportunity.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      result.deduplicatedOpportunities = deleted.count;
      logger.info(`[Cleanup] Removed ${deleted.count} duplicate opportunities`);
    }
  }

  // 0b. Expire by date: finished events / closed application deadlines that
  //     are still listed (no explicit expiresAt yet). Setting expiresAt here
  //     lets step 1 below delete them on the next cleanup run.
  await expireByDate(now);

  // 1. Delete ONLY explicitly expired opportunities (expiresAt in the past)
  //    These have a clear expiration date from the source — safe to remove
  const expired = await prisma.opportunity.deleteMany({
    where: {
      sourceId: { not: null },
      expiresAt: { not: null, lt: now },
    },
  });
  result.expiredOpportunities = expired.count;

  // 2. Flag stale opportunities (not synced in 60 days) with a tag
  //    but do NOT delete them — they may still be active on the source.
  //    The next import cycle will refresh them if they still exist.
  const staleDate = new Date(now.getTime() - 60 * DAYS_MS);
  const staleOpps = await prisma.opportunity.findMany({
    where: {
      sourceId: { not: null },
      lastSyncedAt: { not: null, lt: staleDate },
      expiresAt: null, // no explicit expiration — can't safely delete
    },
    select: { id: true },
  });
  // We don't delete — just count for monitoring
  result.flaggedStaleOpportunities = staleOpps.length;
  if (staleOpps.length > 0) {
    logger.warn(`[Cleanup] ${staleOpps.length} opportunities not synced in 60+ days — keeping (no expiresAt)`);
  }

  // 3. Soft-delete universities not synced in 12 months (imported only)
  //    University data is very stable, 12 months is conservative
  const uniStaleDate = new Date(now.getTime() - 365 * DAYS_MS);
  const deactivatedUnis = await prisma.university.updateMany({
    where: {
      sourceId: { not: null },
      isActive: true,
      lastSyncedAt: { not: null, lt: uniStaleDate },
    },
    data: { isActive: false },
  });
  result.deactivatedUniversities = deactivatedUnis.count;

  // 4. Soft-delete courses not synced in 12 months (imported only)
  const deactivatedCourses = await prisma.course.updateMany({
    where: {
      sourceId: { not: null },
      isActive: true,
      lastSyncedAt: { not: null, lt: uniStaleDate },
    },
    data: { isActive: false },
  });
  result.deactivatedCourses = deactivatedCourses.count;

  // 5. Prune old import logs (>90 days)
  const logCutoff = new Date(now.getTime() - 90 * DAYS_MS);
  const prunedLogs = await prisma.importLog.deleteMany({
    where: { startedAt: { lt: logCutoff } },
  });
  result.prunedLogs = prunedLogs.count;

  logger.info('[Cleanup] Done', { ...result });
  return result;
}

/**
 * Get stats about data freshness — useful for admin dashboard (legacy, kept for /status endpoint)
 */
export async function getDataFreshnessStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAYS_MS);
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * DAYS_MS);

  const [
    totalOpportunities, importedOpportunities, freshOpportunities, staleOpportunities,
    totalUniversities, activeUniversities, totalCourses, activeCourses,
    lastImports, recentErrors,
    euresCount, euYouthCount, eurodesCount, murOppCount,
  ] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { sourceId: { not: null } } }),
    prisma.opportunity.count({ where: { sourceId: { not: null }, lastSyncedAt: { gt: thirtyDaysAgo } } }),
    prisma.opportunity.count({ where: { sourceId: { not: null }, lastSyncedAt: { lt: sixtyDaysAgo } } }),
    prisma.university.count(),
    prisma.university.count({ where: { isActive: true } }),
    prisma.course.count(),
    prisma.course.count({ where: { isActive: true } }),
    prisma.importLog.findMany({
      where: { status: 'success' }, orderBy: { startedAt: 'desc' }, take: 10,
      select: { source: true, type: true, count: true, startedAt: true },
    }),
    prisma.importLog.findMany({
      where: { status: 'failed' }, orderBy: { startedAt: 'desc' }, take: 5,
      select: { source: true, type: true, error: true, startedAt: true },
    }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eures-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eu-youth-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eurodesk-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'mur-' } } }),
  ]);

  return {
    opportunities: {
      total: totalOpportunities, imported: importedOpportunities,
      fresh: freshOpportunities, stale: staleOpportunities,
      bySource: { eures: euresCount, euYouth: euYouthCount, eurodesk: eurodesCount },
    },
    universities: { total: totalUniversities, active: activeUniversities },
    courses: { total: totalCourses, active: activeCourses },
    lastImports, recentErrors,
  };
}

/**
 * Coverage of "live, deduped, IT-relevant" opportunities per type — the
 * dashboard used to verify progress on the 10k IT-relevant target (PF-118).
 * Each stage narrows the previous one:
 *   total        → all rows of that type
 *   live         → expiresAt is null or in the future
 *   dedup        → live rows collapsed by dedupKey (a null dedupKey never
 *                  collides with another, so untouched legacy rows still
 *                  count individually)
 *   itRelevant   → dedup rows that also satisfy country='IT' OR isRemote OR
 *                  (isAbroad AND type IN (SUMMER_PROGRAM,FELLOWSHIP,EXCHANGE,EVENT))
 */
export async function getImportCoverage() {
  const rows = await prisma.$queryRawUnsafe<{
    type: string; total: bigint; live: bigint; dedup: bigint; it_relevant: bigint;
  }[]>(`
    SELECT
      type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()) AS live,
      COUNT(DISTINCT COALESCE("dedupKey", id)) FILTER (
        WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
      ) AS dedup,
      COUNT(DISTINCT COALESCE("dedupKey", id)) FILTER (
        WHERE ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND (
            country = 'IT'
            OR "isRemote" = true
            OR ("isAbroad" = true AND type IN ('SUMMER_PROGRAM', 'FELLOWSHIP', 'EXCHANGE', 'EVENT'))
          )
      ) AS it_relevant
    FROM "Opportunity"
    GROUP BY type
    ORDER BY type
  `);

  const byType = rows.map(r => ({
    type: r.type,
    total: Number(r.total),
    live: Number(r.live),
    dedup: Number(r.dedup),
    itRelevant: Number(r.it_relevant),
  }));

  const totals = byType.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      live: acc.live + r.live,
      dedup: acc.dedup + r.dedup,
      itRelevant: acc.itRelevant + r.itRelevant,
    }),
    { total: 0, live: 0, dedup: 0, itRelevant: 0 },
  );

  return { byType, totals, generatedAt: new Date().toISOString() };
}

// All enabled sources tracked in ImportLog. Ordered to match SOURCES.md table.
const ALL_SOURCES = [
  { key: 'opportunity-desk', prefix: 'od-',                schedule: 'Mon/Wed/Fri 02:00' },
  { key: 'eu-youth',         prefix: 'eu-youth-',          schedule: 'Mon 03:30' },
  { key: 'smartrecruiters',  prefix: 'smartrecruiters-',   schedule: 'Mon 04:00' },
  { key: 'hackclub',         prefix: 'hackclub-',          schedule: 'Mon 04:30' },
  { key: 'arbeitnow',        prefix: 'arbeitnow-',         schedule: 'Tue 03:30' },
  { key: 'remoteok',         prefix: 'remoteok-',          schedule: 'Tue 04:00' },
  { key: 'developers-events',prefix: 'devevents-',         schedule: 'Tue 04:30' },
  { key: 'confstech',        prefix: 'confstech-',         schedule: 'Wed 03:00' },
  { key: 'stage4eu',         prefix: 'stage4eu-',          schedule: 'Wed 03:30' },
  { key: 'company-watchlist',prefix: 'company-watchlist-', schedule: 'Wed 05:30' },
  { key: 'greenhouse',       prefix: 'greenhouse-',        schedule: 'Thu 03:30' },
  { key: 'jobicy',           prefix: 'jobicy-',            schedule: 'Thu 04:00' },
  { key: 'techconfit',       prefix: 'techconfit-',        schedule: 'Thu 04:30' },
  { key: 'lever',            prefix: 'lever-',             schedule: 'Fri 03:30' },
  { key: 'fashionunited',    prefix: 'fashionunited-',     schedule: 'Fri 04:00' },
  { key: 'mobilizon-it',     prefix: 'mobilizon-',         schedule: 'Fri 04:30' },
  { key: 'ashby',            prefix: 'ashby-',             schedule: 'Sat 03:30' },
  { key: 'workable',         prefix: 'workable-',          schedule: 'Sat 04:00' },
  { key: 'personio',         prefix: 'personio-',          schedule: 'Sun 03:30' },
  { key: 'mur',              prefix: 'mur-',               schedule: 'Monthly 1st 02:00' },
  { key: 'almalaurea',       prefix: 'almalaurea-',        schedule: 'Quarterly' },
  { key: 'anpal',            prefix: 'anpal-',             schedule: 'Monthly 1st 03:00' },
  { key: 'devfolio',         prefix: 'devfolio-',          schedule: 'Tue 04:45' },
  { key: 'msca',             prefix: 'msca-',              schedule: 'Mon 05:00' },
  // Produces HarvestTarget rows, not Opportunity rows — no sourceId prefix to count against.
  { key: 'harvest-discovery',prefix: null,                 schedule: 'Mon 03:00' },
  { key: 'harvest-feeds',    prefix: 'harvest-',           schedule: 'Tue 05:00' },
] as const;

/**
 * Per-source health: last run, last success, last error, record count, 30-day success rate.
 * Covers all ENABLED sources from SOURCES.md.
 */
export async function getSourceHealthStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAYS_MS);

  const results: Record<string, {
    schedule: string;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    lastError: string | null;
    recordCount: number;
    successRateLast30d: number | null;
  }> = {};

  await Promise.all(ALL_SOURCES.map(async ({ key, prefix, schedule }) => {
    const [lastSuccess, lastFail, recentRuns, recordCount] = await Promise.all([
      prisma.importLog.findFirst({
        where: { source: key, status: 'success' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      prisma.importLog.findFirst({
        where: { source: key, status: 'failed' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, error: true },
      }),
      prisma.importLog.findMany({
        where: { source: key, startedAt: { gte: thirtyDaysAgo } },
        select: { status: true },
      }),
      prefix === null ? Promise.resolve(0) : prisma.opportunity.count({ where: { sourceId: { startsWith: prefix } } }),
    ]);

    const totalRuns = recentRuns.length;
    const successRuns = recentRuns.filter(r => r.status === 'success').length;

    results[key] = {
      schedule,
      lastRunAt: lastSuccess?.startedAt ?? lastFail?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      lastError: lastFail?.error ?? null,
      recordCount,
      successRateLast30d: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null,
    };
  }));

  return { sources: results, generatedAt: now.toISOString() };
}

/**
 * Opportunity distribution by type, sector (top tags), region, and country.
 * Used for the Phase 6 dashboard and admin analytics.
 */
export async function getOpportunityDistribution() {
  const now = new Date();

  const [byType, byCountry, byRegion, allTags] = await Promise.all([
    // Count by OpportunityType
    prisma.opportunity.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { expiresAt: null },
      orderBy: { _count: { id: 'desc' } },
    }),
    // Count by country (top 15)
    prisma.opportunity.groupBy({
      by: ['country'],
      _count: { id: true },
      where: { expiresAt: null, country: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    }),
    // Count by region (Italy only, top 20)
    prisma.opportunity.groupBy({
      by: ['region'],
      _count: { id: true },
      where: { expiresAt: null, region: { not: null }, country: 'IT' },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
    // Fetch all active opportunity tags for sector frequency analysis
    prisma.opportunity.findMany({
      where: { expiresAt: null, sourceId: { not: null } },
      select: { tags: true },
    }),
  ]);

  // Aggregate sector tags — count occurrences of each tag across all opportunities
  const tagFreq: Record<string, number> = {};
  for (const opp of allTags) {
    for (const tag of opp.tags ?? []) {
      if (tag) tagFreq[tag.toLowerCase()] = (tagFreq[tag.toLowerCase()] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, count]) => ({ tag, count }));

  return {
    byType: byType.map(r => ({ type: r.type, count: r._count.id })),
    byCountry: byCountry.map(r => ({ country: r.country!, count: r._count.id })),
    byRegion: byRegion.map(r => ({ region: r.region!, count: r._count.id })),
    topSectorTags: topTags,
    generatedAt: now.toISOString(),
  };
}

export interface DedupCandidatePair {
  idA: string;
  idB: string;
  titleA: string;
  titleB: string;
  sourceA: string | null;
  sourceB: string | null;
  similarity: number;
}

/**
 * Dedup quality audit (PF-118 Fase 4) — finds pairs of *live* opportunities
 * with *different* dedupKeys that are semantically near-identical (same
 * real-world posting slipped past the text-based dedupKey, e.g. the same
 * event scraped from two sources with differently-worded titles). Reuses
 * the pgvector cosine-distance idiom already in production in
 * similarity.service.ts::getVectorSimilarUsers, applied to
 * Opportunity.embedding instead of User.embedding.
 *
 * Read-only — returns candidate pairs for manual review, never merges
 * anything automatically (two semantically similar postings are not
 * necessarily the same one; see design spec).
 *
 * O(n²) self-join over live rows with an embedding (~4.5k today) — no ANN
 * index yet (ivfflat/hnsw), deliberately: add one only if this turns out to
 * be slow in practice (YAGNI), not preemptively.
 */
export async function findDedupCandidates(threshold = 0.93, limit = 200): Promise<DedupCandidatePair[]> {
  const rows = await prisma.$queryRawUnsafe<{
    id_a: string; id_b: string; title_a: string; title_b: string;
    source_a: string | null; source_b: string | null; similarity: number;
  }[]>(
    `SELECT a.id AS id_a, b.id AS id_b, a.title AS title_a, b.title AS title_b,
            a.source AS source_a, b.source AS source_b,
            1 - (a.embedding <=> b.embedding) AS similarity
     FROM "Opportunity" a, "Opportunity" b
     WHERE a.id < b.id
       AND a."dedupKey" IS DISTINCT FROM b."dedupKey"
       AND a."expiresAt" IS NULL AND b."expiresAt" IS NULL
       AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
       AND 1 - (a.embedding <=> b.embedding) > $1
     ORDER BY similarity DESC
     LIMIT $2`,
    threshold,
    limit,
  );

  return rows.map(r => ({
    idA: r.id_a,
    idB: r.id_b,
    titleA: r.title_a,
    titleB: r.title_b,
    sourceA: r.source_a,
    sourceB: r.source_b,
    similarity: Number(r.similarity),
  }));
}
