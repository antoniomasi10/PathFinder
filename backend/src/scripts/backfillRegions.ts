/**
 * One-shot backfill: populates `region` (and `city` when missing) for all
 * active Italian opportunities that currently have region IS NULL.
 *
 * Run with:
 *   npx ts-node --transpile-only src/scripts/backfillRegions.ts
 *
 * Idempotent: skips opportunities that already have a region set.
 * Safe to re-run at any time.
 */

import prisma from '../lib/prisma';
import { extractCountryCode } from '../services/import/utils';
import { mapItalianRegion } from '../services/import/geo-italy';

const BATCH_SIZE = 200;
const UPDATE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const now = new Date();

  // Load all active IT-country records without a region, plus those
  // where country is null but location string suggests Italy.
  const opps = await prisma.opportunity.findMany({
    where: {
      region: null,
      OR: [
        { country: 'IT' },
        // Also catch rows where country wasn't set by the importer
        { country: null, location: { not: null } },
      ],
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    },
    select: { id: true, location: true, city: true, country: true },
    orderBy: { postedAt: 'desc' },
  });

  console.log(`[backfillRegions] Found ${opps.length} candidates`);

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (let i = 0; i < opps.length; i += BATCH_SIZE) {
    const batch = opps.slice(i, i + BATCH_SIZE);

    for (const opp of batch) {
      const country = opp.country ?? extractCountryCode(opp.location ?? '');
      if (country !== 'IT') { skipped++; continue; }

      const geo = mapItalianRegion(opp.city ?? opp.location);
      if (!geo) { noMatch++; continue; }

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { region: geo.region },
      });
      updated++;
    }

    const pct = Math.round(((i + batch.length) / opps.length) * 100);
    console.log(`[backfillRegions] ${i + batch.length}/${opps.length} (${pct}%) — updated=${updated} no_match=${noMatch} skipped=${skipped}`);

    if (i + BATCH_SIZE < opps.length) await sleep(UPDATE_DELAY_MS);
  }

  console.log(`\n[backfillRegions] Done. updated=${updated} no_match=${noMatch} skipped_non_it=${skipped}`);
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
