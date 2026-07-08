import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
  },
}));

import { findDedupCandidates } from '../services/import/cleanup.service';
import prisma from '../lib/prisma';

const mockedQuery = vi.mocked(prisma.$queryRawUnsafe);

describe('findDedupCandidates', () => {
  beforeEach(() => {
    mockedQuery.mockReset().mockResolvedValue([]);
  });

  it('passes the threshold and limit as positional query params', async () => {
    await findDedupCandidates(0.9, 50);

    const [, threshold, limit] = mockedQuery.mock.calls[0];
    expect(threshold).toBe(0.9);
    expect(limit).toBe(50);
  });

  it('applies default threshold=0.93 and limit=200 when omitted', async () => {
    await findDedupCandidates();

    const [, threshold, limit] = mockedQuery.mock.calls[0];
    expect(threshold).toBe(0.93);
    expect(limit).toBe(200);
  });

  it('maps snake_case row fields to the camelCase DedupCandidatePair shape', async () => {
    mockedQuery.mockResolvedValue([
      { id_a: 'a1', id_b: 'b1', title_a: 'Hackathon Milano', title_b: 'Milano Hackathon 2026',
        source_a: 'devfolio', source_b: 'harvest-extraction', similarity: 0.97 },
    ]);

    const pairs = await findDedupCandidates();

    expect(pairs).toEqual([{
      idA: 'a1', idB: 'b1', titleA: 'Hackathon Milano', titleB: 'Milano Hackathon 2026',
      sourceA: 'devfolio', sourceB: 'harvest-extraction', similarity: 0.97,
    }]);
  });
});
