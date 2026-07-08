import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    importLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
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
    markStaleOpportunities: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  extractNextData,
  collectHackathons,
  resolveIsAbroad,
  resolveFormat,
  importDevfolioOpportunities,
} from '../services/import/devfolio.import';
import { fetchWithRetry } from '../services/import/utils';
import { batchUpsertOpportunities, markStaleOpportunities } from '../services/import/batch';
import prisma from '../lib/prisma';

const mockedFetch = vi.mocked(fetchWithRetry);
const mockedUpsert = vi.mocked(batchUpsertOpportunities);
const mockedMarkStale = vi.mocked(markStaleOpportunities);

function buildHackathon(overrides: Partial<{
  uuid: string; slug: string; name: string; starts_at: string; ends_at: string; is_online: boolean;
}> = {}) {
  return {
    uuid: 'uuid-1',
    slug: 'test-hack',
    name: 'Test Hackathon',
    starts_at: '2026-09-01T00:00:00Z',
    ends_at: '2026-09-03T00:00:00Z',
    is_online: true,
    timezone: 'Asia/Calcutta',
    settings: { site: 'https://example.com/test-hack', reg_ends_at: '2026-08-25T00:00:00Z' },
    ...overrides,
  };
}

function buildNextDataHtml(data: Record<string, unknown[]>): string {
  const nextData = {
    props: {
      pageProps: {
        dehydratedState: {
          queries: [{ state: { data } }],
        },
      },
    },
  };
  return `<html><body><script id="__NEXT_DATA__">${JSON.stringify(nextData)}</script></body></html>`;
}

describe('extractNextData', () => {
  it('parses the JSON blob out of the __NEXT_DATA__ script tag', () => {
    const html = buildNextDataHtml({ open_hackathons: [] });
    const parsed = extractNextData(html);
    expect(parsed.props.pageProps.dehydratedState.queries).toHaveLength(1);
  });

  it('returns null when the script tag is missing', () => {
    expect(extractNextData('<html><body>no data here</body></html>')).toBeNull();
  });

  it('returns null when the script tag contains malformed JSON', () => {
    const html = '<script id="__NEXT_DATA__">{not valid json</script>';
    expect(extractNextData(html)).toBeNull();
  });
});

describe('collectHackathons', () => {
  it('dedups the same uuid appearing in open/upcoming/featured lists', () => {
    const shared = buildHackathon({ uuid: 'shared-uuid' });
    const nextData = extractNextData(buildNextDataHtml({
      open_hackathons: [shared],
      upcoming_hackathons: [shared],
      featured_hackathons: [shared],
    }));
    expect(collectHackathons(nextData)).toHaveLength(1);
  });

  it('collects distinct uuids across all three lists', () => {
    const a = buildHackathon({ uuid: 'a' });
    const b = buildHackathon({ uuid: 'b' });
    const c = buildHackathon({ uuid: 'c' });
    const nextData = extractNextData(buildNextDataHtml({
      open_hackathons: [a],
      upcoming_hackathons: [b],
      featured_hackathons: [c],
    }));
    expect(collectHackathons(nextData).map(h => h.uuid).sort()).toEqual(['a', 'b', 'c']);
  });

  it('skips entries without a uuid and tolerates missing/non-array keys', () => {
    const nextData = extractNextData(buildNextDataHtml({
      open_hackathons: [{ name: 'no uuid here' } as any],
      upcoming_hackathons: 'not-an-array' as any,
    }));
    expect(collectHackathons(nextData)).toHaveLength(0);
  });

  it('returns an empty array when nextData has no queries', () => {
    expect(collectHackathons({})).toEqual([]);
    expect(collectHackathons(null)).toEqual([]);
  });
});

describe('resolveIsAbroad / resolveFormat', () => {
  it('treats online hackathons as not abroad and ONLINE format', () => {
    expect(resolveIsAbroad(true)).toBe(false);
    expect(resolveFormat(true)).toBe('ONLINE');
  });

  it('treats in-person hackathons as abroad and IN_PERSON format', () => {
    expect(resolveIsAbroad(false)).toBe(true);
    expect(resolveFormat(false)).toBe('IN_PERSON');
  });
});

describe('importDevfolioOpportunities', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedUpsert.mockReset().mockResolvedValue(undefined);
    mockedMarkStale.mockReset().mockResolvedValue(0);
    vi.mocked(prisma.importLog.create).mockClear();
    vi.mocked(prisma.importLog.update).mockClear();
  });

  it('maps listing hackathons into HACKATHON records with no duplicate ids', async () => {
    const online = buildHackathon({ uuid: 'uuid-online', name: 'Online Hack', is_online: true });
    const inPerson = buildHackathon({ uuid: 'uuid-in-person', name: 'India Hack', is_online: false });
    const html = buildNextDataHtml({
      open_hackathons: [online],
      upcoming_hackathons: [inPerson, online], // duplicate uuid across lists
      featured_hackathons: [],
    });

    mockedFetch.mockResolvedValue({ ok: true, text: async () => html } as any);

    const result = await importDevfolioOpportunities();

    expect(result.source).toBe('devfolio');
    expect(result.imported).toBe(2);
    expect(mockedUpsert).toHaveBeenCalledTimes(1);

    const records = mockedUpsert.mock.calls[0][0];
    expect(records).toHaveLength(2);
    expect(new Set(records.map(r => r.id)).size).toBe(2);
    for (const r of records) expect(r.type).toBe('HACKATHON');

    const onlineRecord = records.find(r => r.sourceId === 'devfolio-uuid-online')!;
    expect(onlineRecord.isRemote).toBe(true);
    expect(onlineRecord.isAbroad).toBe(false);
    expect(onlineRecord.format).toBe('ONLINE');

    const inPersonRecord = records.find(r => r.sourceId === 'devfolio-uuid-in-person')!;
    expect(inPersonRecord.isRemote).toBe(false);
    expect(inPersonRecord.isAbroad).toBe(true);
    expect(inPersonRecord.format).toBe('IN_PERSON');

    expect(mockedMarkStale).toHaveBeenCalledWith('devfolio', expect.arrayContaining(['devfolio-uuid-online', 'devfolio-uuid-in-person']), { minSeenForStale: 3 });
  });

  it('marks the import as failed when the listing fetch fails', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 503 } as any);

    const result = await importDevfolioOpportunities();

    expect(result.source).toBe('failed');
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(prisma.importLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('marks the import as failed when __NEXT_DATA__ is missing from the page', async () => {
    mockedFetch.mockResolvedValue({ ok: true, text: async () => '<html>no data</html>' } as any);

    const result = await importDevfolioOpportunities();

    expect(result.source).toBe('failed');
    expect(mockedUpsert).not.toHaveBeenCalled();
  });
});
