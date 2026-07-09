/**
 * Registry funnel dashboard — how many candidates are at each stage, from raw
 * ingest (CompanyRegistry) through resolution (CompanyWatchlist), the scrape
 * queue, and into live Italy-relevant opportunities. One-stop view for judging
 * whether the Fase 5 company-first scale-up is actually moving the needle.
 */
import prisma from '../../../lib/prisma';
import { getQueueStats } from '../discovery/queue';
import { getImportCoverage } from '../cleanup.service';
import { getSpendUsd } from '../../ai/usage-report';

const LLM_DAILY_BUDGET_USD = Number(process.env.LLM_DAILY_BUDGET_USD ?? 5);

export async function getRegistryFunnel() {
  const [
    registryTotal, bySource, byStatus,
    watchlistTotal, watchlistByTier, complianceBlocked, autoDisabled,
    queueStats, coverage, llmSpend24h,
  ] = await Promise.all([
    prisma.companyRegistry.count(),
    prisma.companyRegistry.groupBy({ by: ['source'], _count: { _all: true } }),
    prisma.companyRegistry.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.companyWatchlist.count({ where: { discoverySource: { startsWith: 'registry:' } } }),
    prisma.companyWatchlist.groupBy({
      by: ['scrapeTier'],
      where: { discoverySource: { startsWith: 'registry:' } },
      _count: { _all: true },
    }),
    prisma.companyWatchlist.count({
      where: { discoverySource: { startsWith: 'registry:' }, OR: [{ robotsAllowed: false }, { tosAllowed: false }] },
    }),
    prisma.companyWatchlist.count({
      where: { discoverySource: { startsWith: 'registry:' }, isActive: false, consecutiveFailures: { gte: 5 } },
    }),
    getQueueStats(),
    getImportCoverage(),
    getSpendUsd(24),
  ]);

  return {
    registry: {
      total: registryTotal,
      bySource: Object.fromEntries(bySource.map(r => [r.source, r._count._all])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count._all])),
    },
    watchlist: {
      total: watchlistTotal,
      byTier: Object.fromEntries(watchlistByTier.map(r => [r.scrapeTier ?? 'none', r._count._all])),
      complianceBlocked,
      autoDisabled,
    },
    queue: queueStats,
    opportunities: {
      itRelevantTotal: coverage.totals.itRelevant,
      liveTotal: coverage.totals.live,
    },
    llm: {
      last24hUsd: llmSpend24h,
      budgetUsd: LLM_DAILY_BUDGET_USD,
      overBudget: llmSpend24h === null || llmSpend24h >= LLM_DAILY_BUDGET_USD,
    },
    generatedAt: new Date().toISOString(),
  };
}
