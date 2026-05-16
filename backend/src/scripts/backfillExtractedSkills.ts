/**
 * One-shot backfill: populates extractedSkills for all active opportunities
 * that have an empty extractedSkills array.
 *
 * Run with: npx ts-node --transpile-only src/scripts/backfillExtractedSkills.ts
 *
 * Costs roughly 0.30€ for ~500 opportunities with gpt-4o-mini.
 * Safe to re-run: skips opportunities that already have extractedSkills populated.
 */

import prisma from '../lib/prisma';
import { extractOpportunitySkills } from '../services/ai/opportunityParser';

const DELAY_MS = 200;
const BATCH_LIMIT = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const now = new Date();

  const opps = await prisma.opportunity.findMany({
    where: {
      extractedSkills: { isEmpty: true },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { id: true, title: true, description: true, about: true },
    take: BATCH_LIMIT,
    orderBy: { postedAt: 'desc' },
  });

  console.log(`[backfillExtractedSkills] Found ${opps.length} opportunities to process`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < opps.length; i++) {
    const opp = opps[i];
    try {
      const skills = await extractOpportunitySkills(opp.title, opp.description, opp.about);

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { extractedSkills: skills },
      });

      if (skills.length > 0) {
        updated++;
        console.log(`[${i + 1}/${opps.length}] "${opp.title}" → [${skills.join(', ')}]`);
      } else {
        skipped++;
        console.log(`[${i + 1}/${opps.length}] "${opp.title}" → (no skills extracted)`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${opps.length}] ERROR for "${opp.title}":`, err);
    }

    if (i < opps.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n[backfillExtractedSkills] Done. updated=${updated} skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
