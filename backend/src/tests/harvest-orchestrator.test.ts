import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    importLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }), update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../services/import/discovery/opportunity-page-resolver', () => ({
  resolveOpportunityPage: vi.fn(),
}));

vi.mock('../services/import/discovery/feed-fingerprint', () => ({
  fingerprintFeed: vi.fn(),
}));

vi.mock('../services/import/discovery/harvest-registry', () => ({
  registerHarvestTarget: vi.fn().mockResolvedValue({ created: true }),
}));

// Replace the real 32-entry ESN seed with two controlled candidates for deterministic routing tests.
vi.mock('../services/import/discovery/connectors/student-orgs.connector', () => ({
  studentOrgsConnector: {
    name: 'harvest:seed-italy-student-orgs',
    discover: vi.fn().mockResolvedValue([
      { name: 'ESN Milano', domain: 'esnmilano.it', categoryHint: 'EVENT', country: 'IT', region: 'Lombardia', sourceLabel: 'esn-locale', source: 'harvest:seed-italy-student-orgs' },
      { name: 'ESN Torino', domain: 'esntorino.it', categoryHint: 'EVENT', country: 'IT', region: 'Piemonte', sourceLabel: 'esn-locale', source: 'harvest:seed-italy-student-orgs' },
    ]),
  },
}));

import { runHarvestDiscovery } from '../services/import/discovery/harvest.orchestrator';
import { resolveOpportunityPage } from '../services/import/discovery/opportunity-page-resolver';
import { fingerprintFeed } from '../services/import/discovery/feed-fingerprint';
import { registerHarvestTarget } from '../services/import/discovery/harvest-registry';

const mockedResolve = vi.mocked(resolveOpportunityPage);
const mockedFingerprint = vi.mocked(fingerprintFeed);
const mockedRegister = vi.mocked(registerHarvestTarget);

describe('runHarvestDiscovery', () => {
  beforeEach(() => {
    mockedResolve.mockReset();
    mockedFingerprint.mockReset();
    mockedRegister.mockReset().mockResolvedValue({ created: true });
  });

  it('registers html-static targets with scrapeTier B', async () => {
    mockedResolve.mockResolvedValue({ url: 'https://esnmilano.it/events', html: '<html></html>' });
    mockedFingerprint.mockReturnValue({ kind: 'html-static' });

    const out = await runHarvestDiscovery();

    expect(out.discovered).toBe(2);
    expect(out.registered).toBe(2);
    expect(out.unresolved).toBe(0);
    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ feedKind: 'html-static', scrapeTier: 'B' }));
  });

  it('registers html-js targets with scrapeTier C', async () => {
    mockedResolve.mockResolvedValue({ url: 'https://esnmilano.it/events', html: '<html></html>' });
    mockedFingerprint.mockReturnValue({ kind: 'html-js' });

    await runHarvestDiscovery();

    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ feedKind: 'html-js', scrapeTier: 'C' }));
  });

  it('registers structured feeds (jsonld/ics/rss) with scrapeTier null — they bypass the queue', async () => {
    mockedResolve.mockResolvedValue({ url: 'https://esnmilano.it/events', html: '<html></html>' });
    mockedFingerprint.mockReturnValue({ kind: 'jsonld' });

    await runHarvestDiscovery();

    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ feedKind: 'jsonld', scrapeTier: null }));
  });

  it('uses fingerprint.feedUrl instead of the resolved page url when present (ics/rss)', async () => {
    mockedResolve.mockResolvedValue({ url: 'https://esnmilano.it/events', html: '<html></html>' });
    mockedFingerprint.mockReturnValue({ kind: 'rss', feedUrl: 'https://esnmilano.it/feed' });

    await runHarvestDiscovery();

    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://esnmilano.it/feed' }));
  });

  it('counts unresolved candidates without registering them', async () => {
    mockedResolve.mockResolvedValue(null);

    const out = await runHarvestDiscovery();

    expect(out.unresolved).toBe(2);
    expect(out.registered).toBe(0);
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('propagates the categoryHint from the candidate to the registered target', async () => {
    mockedResolve.mockResolvedValue({ url: 'https://esnmilano.it/events', html: '<html></html>' });
    mockedFingerprint.mockReturnValue({ kind: 'html-static' });

    await runHarvestDiscovery();

    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ categoryHint: 'EVENT' }));
  });
});
