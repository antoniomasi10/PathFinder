/**
 * Re-backfill: resets and re-extracts requiredLanguages for active STAGE/INTERNSHIP
 * opportunities using the updated prompt that infers language from context
 * (German gender notation, company location, etc.).
 *
 * Run with: npx ts-node --transpile-only src/scripts/backfillRequiredLanguagesStage.ts
 *
 * Safe to re-run: processes all active STAGE/INTERNSHIP regardless of current value.
 */

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { extractRequiredLanguages } from '../services/ai/opportunityParser';

const DELAY_MS = 200;
const BATCH_LIMIT = 2000;
const CONCURRENCY = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const now = new Date();

  const opps = await prisma.opportunity.findMany({
    where: {
      type: { in: ['STAGE', 'INTERNSHIP'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, title: true, description: true, about: true },
    take: BATCH_LIMIT,
    orderBy: { postedAt: 'desc' },
  });

  console.log(`[backfillRequiredLanguagesStage] Found ${opps.length} STAGE/INTERNSHIP to re-process`);

  let updated = 0;
  let empty = 0;
  let errors = 0;

  for (let i = 0; i < opps.length; i += CONCURRENCY) {
    const chunk = opps.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (opp, j) => {
        const idx = i + j + 1;
        try {
          const langs = await extractRequiredLanguages(opp.title, opp.description, opp.about);
          await prisma.opportunity.update({
            where: { id: opp.id },
            data: { requiredLanguages: (langs ?? []) as unknown as Prisma.InputJsonValue },
          });
          if (langs && langs.length > 0) {
            updated++;
            console.log(`[${idx}/${opps.length}] "${opp.title}" → ${langs.map(l => `${l.lang}${l.level ? ' ' + l.level : ''}`).join(', ')}`);
          } else {
            empty++;
          }
        } catch (err) {
          errors++;
          console.error(`[${idx}/${opps.length}] ERROR "${opp.title}":`, err);
        }
      }),
    );
    if (i + CONCURRENCY < opps.length) await sleep(DELAY_MS);
  }

  console.log(`\n[backfillRequiredLanguagesStage] Done. with_langs=${updated} empty=${empty} errors=${errors}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
