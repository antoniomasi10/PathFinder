/**
 * One-time migration: transfer the hardcoded ATS board maps (seeds) into the
 * CompanyWatchlist registry as tier-A sources, so the ATS factory + discovery
 * become fully DB-driven.
 *
 * Idempotent — keyed on the canonical board URL. Safe to re-run.
 *
 * Run:  npx ts-node src/scripts/migrateAtsBoardsToRegistry.ts
 */
import prisma from '../lib/prisma';
import { registerAtsBoard } from '../services/import/ats/registry';
import { ATS_ADAPTERS } from '../services/import/ats/adapters';
import { PERSONIO_SEED_BOARDS } from '../services/import/personio.import';
import { SMARTRECRUITERS_SEED_BOARDS } from '../services/import/smartrecruiters.import';

async function migratePlatform(platform: string, boards: Record<string, string>) {
  let created = 0;
  let updated = 0;
  for (const [token, name] of Object.entries(boards)) {
    const r = await registerAtsBoard({ platform, token, name, discoverySource: 'seed:migration' });
    r.created ? created++ : updated++;
  }
  console.log(`[migrateAtsBoards] ${platform}: ${Object.keys(boards).length} boards (created=${created}, updated=${updated})`);
}

async function main() {
  // Factory adapters (greenhouse/lever/ashby/workable/recruitee) carry their seed.
  for (const adapter of ATS_ADAPTERS) {
    await migratePlatform(adapter.platform, adapter.seedBoards || {});
  }
  // Bespoke connectors that now also read tokens from the registry.
  await migratePlatform('personio', PERSONIO_SEED_BOARDS);
  await migratePlatform('smartrecruiters', SMARTRECRUITERS_SEED_BOARDS);

  const total = await prisma.companyWatchlist.count({ where: { scrapeTier: 'A' } });
  console.log(`[migrateAtsBoards] Done. Total tier-A boards in registry: ${total}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
