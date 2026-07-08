import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../lib/prisma';
import { getSourceHealthStats } from '../services/import/cleanup.service';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('getSourceHealthStats', () => {
  it('includes the Fase 3 sources (devfolio, msca, harvest-discovery, harvest-feeds)', async () => {
    const { sources } = await getSourceHealthStats();

    for (const key of ['devfolio', 'msca', 'harvest-discovery', 'harvest-feeds']) {
      expect(sources).toHaveProperty(key);
      expect(sources[key]).toHaveProperty('schedule');
      expect(sources[key]).toHaveProperty('recordCount');
    }
  });

  it('does not throw for a source with no sourceId prefix (harvest-discovery) and reports recordCount 0', async () => {
    const { sources } = await getSourceHealthStats();
    expect(sources['harvest-discovery'].recordCount).toBe(0);
  });
});
