/**
 * One-shot backfill: populates contextualizedSkills for active TIROCINIO
 * opportunities that have an empty contextualizedSkills array.
 *
 * Run with: npx ts-node --transpile-only src/scripts/backfillContextualizedSkills.ts
 *
 * Safe to re-run: skips opportunities that already have contextualizedSkills populated.
 */

import prisma from '../lib/prisma';
import { extractContextualizedSkills } from '../services/ai/opportunityParser';

const DELAY_MS = 200;
const BATCH_LIMIT = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const now = new Date();

  const opps = await prisma.opportunity.findMany({
    where: {
      type: { in: ['TIROCINIO'] },
      contextualizedSkills: { isEmpty: true },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { id: true, title: true, description: true, about: true, extractedSkills: true },
    take: BATCH_LIMIT,
    orderBy: { postedAt: 'desc' },
  });

  console.log(`[backfillContextualizedSkills] Found ${opps.length} TIROCINIO opportunities to process`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < opps.length; i++) {
    const opp = opps[i];
    try {
      const skills = await extractContextualizedSkills(opp.title, opp.description, opp.extractedSkills, opp.about);

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { contextualizedSkills: skills },
      });

      if (skills.length > 0) {
        updated++;
        console.log(`[${i + 1}/${opps.length}] "${opp.title}"`);
        skills.forEach(s => console.log(`  • ${s}`));
      } else {
        skipped++;
        console.log(`[${i + 1}/${opps.length}] "${opp.title}" → (nessuna skill estratta)`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${opps.length}] ERROR for "${opp.title}":`, err);
    }

    if (i < opps.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n[backfillContextualizedSkills] Done. updated=${updated} skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
