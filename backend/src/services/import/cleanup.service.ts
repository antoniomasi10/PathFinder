/**
 * Data Cleanup Service
 *
 * Retention policy:
 * - Opportunities: delete if expired OR not synced in 30 days (imported only)
 * - Universities/Courses: soft-delete (isActive=false) if not synced in 6 months
 * - ImportLog: delete entries older than 90 days
 *
 * Manual/seed records (sourceId=null) are NEVER auto-deleted.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const DAYS_MS = 24 * 60 * 60 * 1000;

interface CleanupResult {
  expiredOpportunities: number;
  staleOpportunities: number;
  deactivatedUniversities: number;
  deactivatedCourses: number;
  prunedLogs: number;
}

export async function runCleanup(): Promise<CleanupResult> {
  logger.info('[Cleanup] Starting data cleanup...');
  const now = new Date();
  const result: CleanupResult = {
    expiredOpportunities: 0,
    staleOpportunities: 0,
    deactivatedUniversities: 0,
    deactivatedCourses: 0,
    prunedLogs: 0,
  };

  // 1. Delete expired opportunities (imported only, sourceId != null)
  const expired = await prisma.opportunity.deleteMany({
    where: {
      sourceId: { not: null },
      expiresAt: { lt: now },
    },
  });
  result.expiredOpportunities = expired.count;

  // 2. Delete imported opportunities not synced in 30 days
  const staleDate = new Date(now.getTime() - 30 * DAYS_MS);
  const stale = await prisma.opportunity.deleteMany({
    where: {
      sourceId: { not: null },
      lastSyncedAt: { lt: staleDate },
    },
  });
  result.staleOpportunities = stale.count;

  // 3. Soft-delete universities not synced in 6 months (imported only)
  const uniStaleDate = new Date(now.getTime() - 180 * DAYS_MS);
  const deactivatedUnis = await prisma.university.updateMany({
    where: {
      sourceId: { not: null },
      isActive: true,
      lastSyncedAt: { lt: uniStaleDate },
    },
    data: { isActive: false },
  });
  result.deactivatedUniversities = deactivatedUnis.count;

  // 4. Soft-delete courses not synced in 6 months (imported only)
  const deactivatedCourses = await prisma.course.updateMany({
    where: {
      sourceId: { not: null },
      isActive: true,
      lastSyncedAt: { lt: uniStaleDate },
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

  const [
    totalOpportunities,
    importedOpportunities,
    freshOpportunities,
    totalUniversities,
    activeUniversities,
    totalCourses,
    activeCourses,
    lastImports,
  ] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { sourceId: { not: null } } }),
    prisma.opportunity.count({ where: { sourceId: { not: null }, lastSyncedAt: { gt: thirtyDaysAgo } } }),
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
  ]);

  return {
    opportunities: { total: totalOpportunities, imported: importedOpportunities, fresh: freshOpportunities },
    universities: { total: totalUniversities, active: activeUniversities },
    courses: { total: totalCourses, active: activeCourses },
    lastImports,
  };
}
