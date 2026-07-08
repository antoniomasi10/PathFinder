import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    harvestTarget: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../services/import/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/import/utils')>();
  return { ...actual, fetchWithRetry: vi.fn() };
});

vi.mock('../services/import/batch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/import/batch')>();
  return {
    ...actual,
    batchUpsertOpportunities: vi.fn().mockResolvedValue(undefined),
    markStaleOpportunities: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('../services/import/discovery/harvest-compliance', () => ({
  processTargetCompliance: vi.fn().mockResolvedValue(true),
}));

import { runHarvestFeeds } from '../services/import/discovery/harvest-feed-runner';
import { fetchWithRetry } from '../services/import/utils';
import { batchUpsertOpportunities, markStaleOpportunities } from '../services/import/batch';
import { processTargetCompliance } from '../services/import/discovery/harvest-compliance';
import { resetDedupCache } from '../services/import/validation';
import prisma from '../lib/prisma';

const mockedFetch = vi.mocked(fetchWithRetry);
const mockedUpsert = vi.mocked(batchUpsertOpportunities);
const mockedMarkStale = vi.mocked(markStaleOpportunities);
const mockedCompliance = vi.mocked(processTargetCompliance);
const mockedFindMany = vi.mocked(prisma.harvestTarget.findMany);

function buildTarget(overrides: Partial<{ feedKind: string; id: string; name: string; url: string; categoryHint: string | null }> = {}) {
  return {
    id: 'target-1',
    name: 'ESN Milano',
    url: 'https://esnmilano.it/events',
    sourceLabel: 'esn-locale',
    categoryHint: null,
    country: 'IT',
    feedKind: 'jsonld',
    ...overrides,
  } as any;
}

describe('runHarvestFeeds', () => {
  beforeEach(() => {
    resetDedupCache();
    mockedFetch.mockReset();
    mockedUpsert.mockReset().mockResolvedValue(undefined);
    mockedMarkStale.mockReset().mockResolvedValue(0);
    mockedCompliance.mockReset().mockResolvedValue(true);
    mockedFindMany.mockReset();
  });

  it('maps JSON-LD events into HarvestTarget-sourced records', async () => {
    mockedFindMany.mockResolvedValue([buildTarget({ feedKind: 'jsonld' })]);
    const html = `<script type="application/ld+json">{"@type":"Event","name":"Welcome Week",
      "startDate":"2026-09-15","endDate":"2026-09-20","description":"A welcome week.",
      "location":{"name":"Milano"}}</script>`;
    mockedFetch.mockResolvedValue({ ok: true, text: async () => html } as any);

    const result = await runHarvestFeeds();

    expect(result.imported).toBe(1);
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
    const [record] = mockedUpsert.mock.calls[0][0];
    expect(record.title).toBe('Welcome Week');
    expect(record.source).toBe('HarvestTarget');
    expect(record.type).toBe('EVENT');
  });

  it('maps ICS VEVENT blocks into records', async () => {
    mockedFindMany.mockResolvedValue([buildTarget({ feedKind: 'ics', id: 'target-2' })]);
    const ics = [
      'BEGIN:VEVENT',
      'SUMMARY:Winter Trip',
      'DTSTART:20260110T090000Z',
      'DTEND:20260112T180000Z',
      'DESCRIPTION:A weekend trip.',
      'LOCATION:Torino',
      'END:VEVENT',
    ].join('\r\n');
    mockedFetch.mockResolvedValue({ ok: true, text: async () => ics } as any);

    const result = await runHarvestFeeds();

    expect(result.imported).toBe(1);
    const [record] = mockedUpsert.mock.calls[0][0];
    expect(record.title).toBe('Winter Trip');
    expect(record.startDate?.toISOString()).toBe(new Date('2026-01-10T09:00:00Z').toISOString());
  });

  it('maps RSS items into records', async () => {
    mockedFindMany.mockResolvedValue([buildTarget({ feedKind: 'rss', id: 'target-3' })]);
    const rss = `<?xml version="1.0"?><rss><channel><item>
      <title>Career Day 2026</title>
      <link>https://esnmilano.it/career-day</link>
      <description>Meet local employers.</description>
      <guid>https://esnmilano.it/career-day</guid>
    </item></channel></rss>`;
    mockedFetch.mockResolvedValue({ ok: true, text: async () => rss } as any);

    const result = await runHarvestFeeds();

    expect(result.imported).toBe(1);
    const [record] = mockedUpsert.mock.calls[0][0];
    expect(record.title).toBe('Career Day 2026');
  });

  it('respects the compliance gate and does not fetch/import when blocked', async () => {
    mockedFindMany.mockResolvedValue([buildTarget()]);
    mockedCompliance.mockResolvedValue(false);

    const result = await runHarvestFeeds();

    expect(result.imported).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('continues to the next target when one fetch fails', async () => {
    mockedFindMany.mockResolvedValue([
      buildTarget({ id: 'target-a', url: 'https://a.example.org' }),
      buildTarget({ id: 'target-b', url: 'https://b.example.org' }),
    ]);
    mockedFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<script type="application/ld+json">{"@type":"Event","name":"Still Works"}</script>',
      } as any);

    const result = await runHarvestFeeds();

    expect(result.targets).toBe(2);
    expect(result.imported).toBe(1);
  });
});
