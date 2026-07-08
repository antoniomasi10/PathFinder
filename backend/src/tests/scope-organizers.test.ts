import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    opportunity: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}));

import { markStaleOpportunities } from '../services/import/batch';
import prisma from '../lib/prisma';

const mockedUpdateMany = vi.mocked(prisma.opportunity.updateMany);

describe('markStaleOpportunities scoping', () => {
  beforeEach(() => {
    mockedUpdateMany.mockReset().mockResolvedValue({ count: 0 } as any);
  });

  it('scopes by organizer when scopeOrganizers is provided', async () => {
    await markStaleOpportunities('HarvestTarget', ['id-1'], { scopeOrganizers: ['ESN Milano'] });

    expect(mockedUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizer: { in: ['ESN Milano'] } }),
    }));
    const call = mockedUpdateMany.mock.calls[0][0] as any;
    expect(call.where.company).toBeUndefined();
  });

  it('scopes by company when scopeCompanies is provided (unaffected by the new option)', async () => {
    await markStaleOpportunities('CompanyWatchlist', ['id-1'], { scopeCompanies: ['Acme'] });

    const call = mockedUpdateMany.mock.calls[0][0] as any;
    expect(call.where.company).toEqual({ in: ['Acme'] });
    expect(call.where.organizer).toBeUndefined();
  });

  it('applies neither filter when no scope option is passed', async () => {
    await markStaleOpportunities('devfolio', ['id-1']);

    const call = mockedUpdateMany.mock.calls[0][0] as any;
    expect(call.where.company).toBeUndefined();
    expect(call.where.organizer).toBeUndefined();
  });

  it('can combine scopeCompanies and scopeOrganizers in the same call', async () => {
    await markStaleOpportunities('mixed-source', ['id-1'], {
      scopeCompanies: ['Acme'], scopeOrganizers: ['ESN Milano'],
    });

    const call = mockedUpdateMany.mock.calls[0][0] as any;
    expect(call.where.company).toEqual({ in: ['Acme'] });
    expect(call.where.organizer).toEqual({ in: ['ESN Milano'] });
  });
});
