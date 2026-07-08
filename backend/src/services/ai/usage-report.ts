/**
 * LLM cost rollup — reads LlmUsageLog (see openai-client.ts::trackedCompletion)
 * and aggregates token usage per source/purpose/model over a few time windows.
 * Cost is estimated at read time via OPENAI_PRICING, never stored, so it never
 * goes stale when OpenAI reprices a model.
 */
import prisma from '../../lib/prisma';
import { estimateCostUsd } from './openai-client';

const DAY_MS = 24 * 60 * 60 * 1000;

interface UsageBreakdown {
  source: string;
  purpose: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

interface UsageWindow {
  window: '24h' | '7d' | '30d' | 'all';
  breakdown: UsageBreakdown[];
  totalTokens: number;
  totalEstimatedCostUsd: number | null;
}

async function reportForWindow(window: UsageWindow['window'], since: Date | null): Promise<UsageWindow> {
  const grouped = await prisma.llmUsageLog.groupBy({
    by: ['source', 'purpose', 'model'],
    _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    ...(since ? { where: { createdAt: { gte: since } } } : {}),
  });

  const breakdown: UsageBreakdown[] = grouped.map(g => {
    const promptTokens = g._sum.promptTokens ?? 0;
    const completionTokens = g._sum.completionTokens ?? 0;
    return {
      source: g.source,
      purpose: g.purpose,
      model: g.model,
      promptTokens,
      completionTokens,
      totalTokens: g._sum.totalTokens ?? 0,
      estimatedCostUsd: estimateCostUsd(g.model, promptTokens, completionTokens),
    };
  });

  breakdown.sort((a, b) => b.totalTokens - a.totalTokens);

  const totalTokens = breakdown.reduce((sum, b) => sum + b.totalTokens, 0);
  // null poisons the sum (an unpriced model in the mix means "can't say for sure") —
  // safer than silently under-reporting cost by skipping the unknown model's tokens.
  const hasUnknownModel = breakdown.some(b => b.estimatedCostUsd === null);
  const totalEstimatedCostUsd = hasUnknownModel
    ? null
    : breakdown.reduce((sum, b) => sum + (b.estimatedCostUsd ?? 0), 0);

  return { window, breakdown, totalTokens, totalEstimatedCostUsd };
}

export async function getLlmCostReport(): Promise<{ windows: UsageWindow[]; generatedAt: string }> {
  const now = new Date();
  const windows = await Promise.all([
    reportForWindow('24h', new Date(now.getTime() - 1 * DAY_MS)),
    reportForWindow('7d', new Date(now.getTime() - 7 * DAY_MS)),
    reportForWindow('30d', new Date(now.getTime() - 30 * DAY_MS)),
    reportForWindow('all', null),
  ]);
  return { windows, generatedAt: now.toISOString() };
}
