import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    harvestTarget: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { registerHarvestTarget } from '../services/import/discovery/harvest-registry';
import prisma from '../lib/prisma';

const mockedFindUnique = vi.mocked(prisma.harvestTarget.findUnique);
const mockedCreate = vi.mocked(prisma.harvestTarget.create);
const mockedUpdate = vi.mocked(prisma.harvestTarget.update);

const BASE_INPUT = {
  name: 'ESN Milano',
  url: 'https://esnmilano.it/events',
  sourceLabel: 'esn-locale',
  discoverySource: 'harvest:seed-italy-student-orgs',
  feedKind: 'html-static',
};

describe('registerHarvestTarget', () => {
  beforeEach(() => {
    mockedFindUnique.mockReset();
    mockedCreate.mockReset().mockResolvedValue({} as any);
    mockedUpdate.mockReset().mockResolvedValue({} as any);
  });

  it('creates a new row when the url is not already registered', async () => {
    mockedFindUnique.mockResolvedValue(null);

    const result = await registerHarvestTarget(BASE_INPUT);

    expect(result.created).toBe(true);
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ url: BASE_INPUT.url, name: 'ESN Milano', feedKind: 'html-static' }),
    }));
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('updates (not duplicates) when the url is already registered', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'existing-id' } as any);

    const result = await registerHarvestTarget(BASE_INPUT);

    expect(result.created).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { url: BASE_INPUT.url } }));
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('defaults scrapeTier/categoryHint/region to null when omitted', async () => {
    mockedFindUnique.mockResolvedValue(null);

    await registerHarvestTarget(BASE_INPUT);

    const call = mockedCreate.mock.calls[0][0] as any;
    expect(call.data.scrapeTier).toBeNull();
    expect(call.data.categoryHint).toBeNull();
    expect(call.data.region).toBeNull();
  });
});
