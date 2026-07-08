import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    llmUsageLog: { groupBy: vi.fn() },
  },
}));

import { getLlmCostReport } from '../services/ai/usage-report';
import prisma from '../lib/prisma';

const mockedGroupBy = vi.mocked(prisma.llmUsageLog.groupBy);

describe('getLlmCostReport', () => {
  beforeEach(() => {
    mockedGroupBy.mockReset();
  });

  it('returns one entry per window (24h/7d/30d/all)', async () => {
    mockedGroupBy.mockResolvedValue([]);
    const report = await getLlmCostReport();
    expect(report.windows.map(w => w.window)).toEqual(['24h', '7d', '30d', 'all']);
  });

  it('computes totalTokens and an estimated cost for a known model', async () => {
    mockedGroupBy.mockResolvedValue([
      {
        source: 'opportunity-enrichment', purpose: 'content-parse', model: 'gpt-4o-mini',
        _sum: { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
      },
    ] as any);

    const report = await getLlmCostReport();
    const window = report.windows[0];

    expect(window.totalTokens).toBe(2_000_000);
    expect(window.totalEstimatedCostUsd).toBeCloseTo(0.15 + 0.60, 5);
    expect(window.breakdown[0].source).toBe('opportunity-enrichment');
  });

  it('sets totalEstimatedCostUsd to null when any model in the mix has no known price', async () => {
    mockedGroupBy.mockResolvedValue([
      { source: 'a', purpose: 'p', model: 'gpt-4o-mini', _sum: { promptTokens: 100, completionTokens: 100, totalTokens: 200 } },
      { source: 'b', purpose: 'p', model: 'some-future-model', _sum: { promptTokens: 100, completionTokens: 100, totalTokens: 200 } },
    ] as any);

    const report = await getLlmCostReport();
    expect(report.windows[0].totalEstimatedCostUsd).toBeNull();
    // the known-model entry still reports its own individual cost
    const known = report.windows[0].breakdown.find(b => b.model === 'gpt-4o-mini');
    expect(known?.estimatedCostUsd).not.toBeNull();
  });

  it('calls groupBy without a date filter for the "all" window', async () => {
    mockedGroupBy.mockResolvedValue([]);
    await getLlmCostReport();

    const allWindowCall = mockedGroupBy.mock.calls[3][0] as any;
    expect(allWindowCall.where).toBeUndefined();
  });
});
