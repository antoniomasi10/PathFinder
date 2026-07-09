/**
 * CompanyRegistry discovery connector (Fase 5) — unlike the seed-based
 * connectors (ats-seed/company-domain/university-careers), this one reads its
 * candidates from the DB-backed CompanyRegistry staging table instead of a
 * static seed list, so it needs claim/reconcile semantics rather than a plain
 * discover(). Used by runRegistryDiscovery() in ../discovery.orchestrator.ts.
 */
import { CompanyRegistry } from '@prisma/client';
import prisma from '../../../../lib/prisma';

/** After this many failed resolution attempts, stop retrying a row. */
const MAX_ATTEMPTS = 2;

/**
 * Claim up to `limit` pending, domain-resolved rows ordered by priority. The
 * `status` column doubles as the resumable cursor — claimed rows move to
 * 'queued' so a concurrent/next run never reprocesses them before reconcile.
 */
export async function claimRegistryBatch(limit: number): Promise<CompanyRegistry[]> {
  const rows = await prisma.companyRegistry.findMany({
    where: {
      status: 'pending',
      // Actionable either via a resolvable domain (resolve→fingerprint→route)
      // or a pre-known ATS token (Common Crawl fast path, no domain needed).
      OR: [
        { domain: { not: null } },
        { AND: [{ atsType: { not: null } }, { atsToken: { not: null } }] },
      ],
    },
    orderBy: { priorityScore: 'desc' },
    take: limit,
  });
  if (rows.length === 0) return rows;

  await prisma.companyRegistry.updateMany({
    where: { id: { in: rows.map(r => r.id) } },
    data: { status: 'queued', attempts: { increment: 1 }, lastAttemptAt: new Date() },
  });
  // Rows were fetched before the increment above — bump the in-memory copies too,
  // so reconcileRegistryBatch's MAX_ATTEMPTS check sees the post-claim count
  // instead of being one run stale.
  return rows.map(r => ({ ...r, attempts: r.attempts + 1 }));
}

/**
 * After routing a claimed batch through the normal discovery path (ATS
 * validate / resolve+fingerprint), check whether each row produced a
 * CompanyWatchlist entry. Found → promoted; not found and out of attempts →
 * unresolved; otherwise → back to pending for a future batch.
 */
export async function reconcileRegistryBatch(rows: CompanyRegistry[]): Promise<{ promoted: number; exhausted: number }> {
  let promoted = 0;
  let exhausted = 0;

  for (const row of rows) {
    const watchlist = row.atsType && row.atsToken
      ? await prisma.companyWatchlist.findFirst({ where: { atsType: row.atsType, atsToken: row.atsToken } })
      : row.domain
        ? await prisma.companyWatchlist.findFirst({ where: { domain: row.domain } })
        : null;

    if (watchlist) {
      await prisma.companyRegistry.update({
        where: { id: row.id },
        data: { status: 'promoted', watchlistId: watchlist.id },
      });
      promoted++;
      continue;
    }

    const giveUp = row.attempts >= MAX_ATTEMPTS;
    await prisma.companyRegistry.update({
      where: { id: row.id },
      data: { status: giveUp ? 'unresolved' : 'pending' },
    });
    if (giveUp) exhausted++;
  }

  return { promoted, exhausted };
}
