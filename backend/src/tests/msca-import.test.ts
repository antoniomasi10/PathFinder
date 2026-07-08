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
    markStaleOpportunities: vi.fn().mockResolvedValue(0),
  };
});

import {
  importMscaOpportunities,
  __testables,
} from '../services/import/msca.import';
import { fetchWithRetry } from '../services/import/utils';
import { batchUpsertOpportunities, markStaleOpportunities } from '../services/import/batch';
import { resetDedupCache } from '../services/import/validation';
import prisma from '../lib/prisma';

const { metaFirst, metaLatestDate, buildSourceId } = __testables;
const mockedFetch = vi.mocked(fetchWithRetry);
const mockedUpsert = vi.mocked(batchUpsertOpportunities);
const mockedMarkStale = vi.mocked(markStaleOpportunities);

function buildResult(overrides: Partial<{
  reference: string;
  url: string;
  summary: string;
  title: string;
  deadlineDate: string[];
  startDate: string[];
  destinationDetails: string;
  identifier: string;
}> = {}) {
  const {
    reference = 'REF1',
    url = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-MSCA-2026-PF-01-01',
    summary = 'MSCA Postdoctoral Fellowships 2026',
    title = 'MSCA Postdoctoral Fellowships 2026',
    deadlineDate = ['2026-09-09T00:00:00.000+0000'],
    startDate = ['2026-04-09T00:00:00.000+0000'],
    destinationDetails = '<p>The goal of MSCA Postdoctoral Fellowships is to enhance researcher careers.</p>',
    identifier = 'HORIZON-MSCA-2026-PF-01-01',
  } = overrides;
  return {
    reference,
    url,
    summary,
    metadata: {
      title: [title],
      deadlineDate,
      startDate,
      destinationDetails: [destinationDetails],
      identifier: [identifier],
    },
  };
}

function mockSearchResponse(results: ReturnType<typeof buildResult>[], totalResults = results.length) {
  mockedFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ totalResults, results }),
  } as any);
}

describe('metaFirst', () => {
  it('returns the first value of a metadata array field', () => {
    expect(metaFirst({ title: ['Hello', 'World'] }, 'title')).toBe('Hello');
  });

  it('returns null for a missing or empty field', () => {
    expect(metaFirst({}, 'title')).toBeNull();
    expect(metaFirst({ title: [] }, 'title')).toBeNull();
  });
});

describe('metaLatestDate', () => {
  it('returns the latest date among multiple deadline entries (multi-stage calls)', () => {
    const d = metaLatestDate({ deadlineDate: ['2025-10-31T17:00:00.000+0000', '2026-09-15T23:00:00.000+0000'] }, 'deadlineDate');
    expect(d?.toISOString()).toBe(new Date('2026-09-15T23:00:00.000+0000').toISOString());
  });

  it('returns null when the field is missing or has no valid dates', () => {
    expect(metaLatestDate({}, 'deadlineDate')).toBeNull();
    expect(metaLatestDate({ deadlineDate: ['not-a-date'] }, 'deadlineDate')).toBeNull();
  });
});

describe('buildSourceId', () => {
  it('prefixes the API reference with msca-', () => {
    expect(buildSourceId('50148683TOPICSen')).toBe('msca-50148683TOPICSen');
  });
});

describe('importMscaOpportunities', () => {
  beforeEach(() => {
    resetDedupCache();
    mockedFetch.mockReset();
    mockedUpsert.mockReset().mockResolvedValue(undefined);
    mockedMarkStale.mockReset().mockResolvedValue(0);
    vi.mocked(prisma.importLog.create).mockClear();
    vi.mocked(prisma.importLog.update).mockClear();
  });

  it('imports open calls as FELLOWSHIP records with the expected mapping', async () => {
    mockSearchResponse([buildResult()]);

    const result = await importMscaOpportunities();

    expect(result.source).toBe('msca');
    expect(result.imported).toBe(1);
    expect(mockedUpsert).toHaveBeenCalledTimes(1);

    const [record] = mockedUpsert.mock.calls[0][0];
    expect(record.type).toBe('FELLOWSHIP');
    expect(record.sourceId).toBe('msca-REF1');
    expect(record.isAbroad).toBe(true);
    expect(record.isRemote).toBe(false);
    expect(record.expiresAt?.toISOString()).toBe(new Date('2026-09-09T00:00:00.000+0000').toISOString());
    expect(record.description).toContain('goal of MSCA Postdoctoral Fellowships');
  });

  it('skips records whose deadline has already passed, despite a forthcoming/open status', async () => {
    mockSearchResponse([buildResult({ reference: 'STALE', deadlineDate: ['2020-01-01T00:00:00.000+0000'] })]);

    const result = await importMscaOpportunities();

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockedUpsert).toHaveBeenCalledWith([]);
  });

  it('skips records with no usable description', async () => {
    mockSearchResponse([buildResult({ reference: 'NODESC', destinationDetails: '' })]);

    const result = await importMscaOpportunities();

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('dedups repeated references within the same response', async () => {
    mockSearchResponse([buildResult({ reference: 'DUP' }), buildResult({ reference: 'DUP' })]);

    const result = await importMscaOpportunities();

    expect(result.imported).toBe(1);
    const records = mockedUpsert.mock.calls[0][0];
    expect(records).toHaveLength(1);
  });

  it('marks the import as failed when the search API request fails', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 503 } as any);

    const result = await importMscaOpportunities();

    expect(result.source).toBe('failed');
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(prisma.importLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });
});
