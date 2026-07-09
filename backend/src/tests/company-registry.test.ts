import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeCompanyName, extractApexDomain } from '../services/import/company-registry/normalize';
import { computePriorityScore } from '../services/import/company-registry/priority';

describe('normalizeCompanyName', () => {
  it('strips common Italian legal-form suffixes', () => {
    expect(normalizeCompanyName('Rossi S.p.A.')).toBe('rossi');
    expect(normalizeCompanyName('Verdi S.r.l.')).toBe('verdi');
    expect(normalizeCompanyName('Bianchi Group')).toBe('bianchi');
  });

  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeCompanyName("D'Amico & Figli S.n.c.")).toBe('d amico figli');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeCompanyName('')).toBe('');
  });
});

describe('extractApexDomain', () => {
  it('extracts the registrable domain from a full URL', () => {
    expect(extractApexDomain('https://www.example.com/careers')).toBe('example.com');
  });

  it('strips a www subdomain but keeps other subdomains as part of the apex pair', () => {
    expect(extractApexDomain('https://careers.example.com')).toBe('example.com');
  });

  it('adds https:// when the scheme is missing', () => {
    expect(extractApexDomain('example.it')).toBe('example.it');
  });

  it('returns null for blocklisted hosts (socials, page builders, webmail)', () => {
    expect(extractApexDomain('https://www.linkedin.com/company/acme')).toBeNull();
    expect(extractApexDomain('https://acme.wixsite.com/site')).toBeNull();
    expect(extractApexDomain('https://www.facebook.com/acme')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractApexDomain('not a url')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractApexDomain('')).toBeNull();
  });
});

describe('computePriorityScore', () => {
  it('scores a bare entity with no signals at the source weight only', () => {
    expect(computePriorityScore('wikidata', {} as any)).toBe(5);
    expect(computePriorityScore('registro-imprese-startup', {} as any)).toBe(10);
    expect(computePriorityScore('unknown-source', {} as any)).toBe(0);
  });

  it('rewards a resolved domain', () => {
    expect(computePriorityScore('wikidata', { domain: 'example.com' } as any)).toBe(5 + 40);
  });

  it('rewards a pre-known ATS token highest (Common Crawl fast path)', () => {
    const score = computePriorityScore('commoncrawl-ats', { atsType: 'greenhouse', atsToken: 'acme' } as any);
    expect(score).toBe(100); // no source weight configured for commoncrawl-ats
  });

  it('stacks employee band and high-yield sector bonuses', () => {
    const score = computePriorityScore('wikidata', {
      domain: 'example.com', employeeBand: '250+', sector: 'ICT',
    } as any);
    expect(score).toBe(5 + 40 + 25 + 10);
  });

  it('gives smaller companies a smaller employee-band bonus', () => {
    const small = computePriorityScore('wikidata', { employeeBand: '10-49' } as any);
    const large = computePriorityScore('wikidata', { employeeBand: '250+' } as any);
    expect(small).toBeLessThan(large);
  });
});

vi.mock('../lib/prisma', () => ({
  default: {
    companyRegistry: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { ingestRegistryEntities } from '../services/import/company-registry/ingest';

const mockedFindMany = vi.mocked(prisma.companyRegistry.findMany);
const mockedUpdate = vi.mocked(prisma.companyRegistry.update);
const mockedCreate = vi.mocked(prisma.companyRegistry.create);

describe('ingestRegistryEntities', () => {
  beforeEach(() => {
    mockedFindMany.mockReset().mockResolvedValue([] as any);
    mockedUpdate.mockReset();
    mockedCreate.mockReset().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new-id', ...data }) as any);
  });

  it('creates a new row for a fresh entity with a resolvable domain', async () => {
    const result = await ingestRegistryEntities('wikidata', [
      { name: 'Acme S.p.A.', websiteUrl: 'https://www.acme.com', sourceRef: 'Q1' },
    ]);

    expect(result).toEqual({ created: 1, updated: 0, duplicates: 0, noDomain: 0 });
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    const created = mockedCreate.mock.calls[0][0].data;
    expect(created.domain).toBe('acme.com');
    expect(created.normalizedName).toBe('acme');
    expect(created.status).toBe('pending');
  });

  it('counts entities with no resolvable domain and marks them no-domain', async () => {
    const result = await ingestRegistryEntities('wikidata', [{ name: 'No Website Inc', sourceRef: 'Q2' }]);

    expect(result.noDomain).toBe(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'no-domain', domain: null }) }),
    );
  });

  it('updates in place when (source, sourceRef) already exists', async () => {
    mockedFindMany.mockImplementation((({ where }: any) => {
      if (where.sourceRef) {
        return Promise.resolve([{ id: 'existing-1', sourceRef: 'Q1', domain: 'acme.com', source: 'wikidata' }]);
      }
      return Promise.resolve([]);
    }) as any);

    const result = await ingestRegistryEntities('wikidata', [
      { name: 'Acme S.p.A.', websiteUrl: 'https://www.acme.com', sourceRef: 'Q1' },
    ]);

    expect(result).toEqual({ created: 0, updated: 1, duplicates: 0, noDomain: 0 });
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-1' } }),
    );
  });

  it('treats a domain already owned by another source as a duplicate, not an update', async () => {
    mockedFindMany.mockImplementation((({ where }: any) => {
      if (where.domain) {
        return Promise.resolve([{ id: 'other-1', domain: 'acme.com', source: 'registro-imprese-startup' }]);
      }
      return Promise.resolve([]);
    }) as any);

    const result = await ingestRegistryEntities('wikidata', [
      { name: 'Acme', websiteUrl: 'https://acme.com', sourceRef: 'Q99' },
    ]);

    expect(result).toEqual({ created: 0, updated: 0, duplicates: 1, noDomain: 0 });
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
