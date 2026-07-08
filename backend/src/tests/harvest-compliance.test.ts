import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    harvestTarget: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../services/import/compliance', () => ({
  checkRobotsTxt: vi.fn(),
  findAndAnalyzeTos: vi.fn(),
  daysSince: (date: Date, now: Date) => (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
}));

import { checkRobotsTxt, findAndAnalyzeTos } from '../services/import/compliance';
import { processTargetCompliance } from '../services/import/discovery/harvest-compliance';
import prisma from '../lib/prisma';

const mockedCheckRobotsTxt = vi.mocked(checkRobotsTxt);
const mockedFindAndAnalyzeTos = vi.mocked(findAndAnalyzeTos);

function buildTarget(overrides: Partial<{
  robotsAllowed: boolean | null; tosAllowed: boolean | null;
  robotsCheckedAt: Date | null; tosAnalyzedAt: Date | null;
}> = {}) {
  return {
    id: 'target-1',
    name: 'ESN Milano',
    url: 'https://esnmilano.it/events',
    robotsAllowed: null,
    tosAllowed: null,
    robotsCheckedAt: null,
    tosAnalyzedAt: null,
    ...overrides,
  } as any;
}

describe('processTargetCompliance', () => {
  beforeEach(() => {
    mockedCheckRobotsTxt.mockReset();
    mockedFindAndAnalyzeTos.mockReset();
    vi.mocked(prisma.harvestTarget.update).mockClear();
  });

  it('blocks when robots.txt disallows scraping', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(false);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: true, notes: 'ok', pageNotFound: false });

    const allowed = await processTargetCompliance(buildTarget(), new Date());

    expect(allowed).toBe(false);
    expect(prisma.harvestTarget.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'target-1' },
      data: expect.objectContaining({ robotsAllowed: false }),
    }));
  });

  it('blocks when ToS prohibits scraping even if robots.txt allows', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: false, notes: 'ToS forbids automated access', pageNotFound: false });

    const allowed = await processTargetCompliance(buildTarget(), new Date());

    expect(allowed).toBe(false);
  });

  it('allows when both robots.txt and ToS are clean', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: true, notes: 'ok', pageNotFound: false });

    const allowed = await processTargetCompliance(buildTarget(), new Date());

    expect(allowed).toBe(true);
  });

  it('uses the cached verdict without a live check when not expired', async () => {
    const now = new Date();
    const target = buildTarget({ robotsAllowed: false, tosAllowed: true, robotsCheckedAt: now, tosAnalyzedAt: now });

    const allowed = await processTargetCompliance(target, now);

    expect(allowed).toBe(false); // cached robotsAllowed=false still blocks
    expect(mockedCheckRobotsTxt).not.toHaveBeenCalled();
    expect(mockedFindAndAnalyzeTos).not.toHaveBeenCalled();
    expect(prisma.harvestTarget.update).not.toHaveBeenCalled();
  });

  it('re-checks live when the cache is older than 30 days', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: true, notes: 'ok', pageNotFound: false });

    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const target = buildTarget({ robotsAllowed: false, tosAllowed: false, robotsCheckedAt: staleDate, tosAnalyzedAt: staleDate });

    const allowed = await processTargetCompliance(target, new Date());

    expect(allowed).toBe(true);
    expect(mockedCheckRobotsTxt).toHaveBeenCalledTimes(1);
  });
});
