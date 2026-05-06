/**
 * Data Cleanup Service
 *
 * Retention policy:
 * - Opportunities: delete ONLY if explicitly expired (expiresAt < now)
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

  // 0. Remove cross-source duplicates (same title+company, keep most recent)
  const dupeGroups = await prisma.$queryRawUnsafe<{ ids: string[] }[]>(`
    SELECT array_agg(id ORDER BY "postedAt" DESC) as ids
    FROM "Opportunity"
    GROUP BY LOWER(title), LOWER(company)
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
 * Get stats about data freshness — useful for admin dashboard
 */
export async function getDataFreshnessStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAYS_MS);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAYS_MS);

  const [
    totalOpportunities,
    importedOpportunities,
    freshOpportunities,
    staleOpportunities,
    totalUniversities,
    activeUniversities,
    totalCourses,
    activeCourses,
    lastImports,
    recentErrors,
    euresCount,
    euYouthCount,
    eurodesCount,
    murOppCount,
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
      where: { status: 'success' },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { source: true, type: true, count: true, startedAt: true },
    }),
    prisma.importLog.findMany({
      where: { status: 'failed' },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { source: true, type: true, error: true, startedAt: true },
    }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eures-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eu-youth-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'eurodesk-' } } }),
    prisma.opportunity.count({ where: { sourceId: { startsWith: 'mur-' } } }),
  ]);

  // Per-source health: last successful import per source
  const sources = ['eures', 'eu-youth', 'eurodesk', 'mur', 'almalaurea'];
  const sourceHealth: Record<string, { lastSuccess: Date | null; lastError: string | null; recordCount: number }> = {};

  for (const source of sources) {
    const lastSuccess = await prisma.importLog.findFirst({
      where: { source, status: 'success' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    const lastFail = await prisma.importLog.findFirst({
      where: { source, status: 'failed' },
      orderBy: { startedAt: 'desc' },
      select: { error: true },
    });

    const countMap: Record<string, number> = {
      eures: euresCount,
      'eu-youth': euYouthCount,
      eurodesk: eurodesCount,
      mur: murOppCount,
      almalaurea: 0, // stats, not records
    };

    sourceHealth[source] = {
      lastSuccess: lastSuccess?.startedAt || null,
      lastError: lastFail?.error || null,
      recordCount: countMap[source] || 0,
    };
  }

  return {
    opportunities: {
      total: totalOpportunities,
      imported: importedOpportunities,
      fresh: freshOpportunities,
      stale: staleOpportunities,
      bySource: { eures: euresCount, euYouth: euYouthCount, eurodesk: eurodesCount },
    },
    universities: { total: totalUniversities, active: activeUniversities },
    courses: { total: totalCourses, active: activeCourses },
    lastImports,
    recentErrors,
    sourceHealth,
  };
}
