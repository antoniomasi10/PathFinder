/**
 * Rewrites titleIt for all active opportunities using the updated GPT prompt.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/rewrite-titles.ts
 *
 * Processes active opportunities in batches of 20 (concurrency 3).
 * Overwrites titleIt (and descriptionIt if missing) with the cleaned version.
 * Safe to interrupt and restart — cursor-based pagination picks up from where it left off.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { translateOpportunityToItalian } from '../src/services/ai/opportunityParser';

const BATCH_SIZE = 20;
const CONCURRENCY = 3;
const CHUNK_DELAY_MS = 700;

type OppRow = { id: string; title: string; description: string; descriptionIt: string | null };

async function main() {
  const now = new Date();
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Opportunity"
    WHERE ("expiresAt" IS NULL OR "expiresAt" > ${now})
  `;
  const total = Number(count);
  console.log(`Found ${total} active opportunities to rewrite`);

  if (total === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;
  let lastId = '';

  while (processed < total) {
    const batch: OppRow[] = lastId
      ? await prisma.$queryRaw`
          SELECT id, title, description, "descriptionIt"
          FROM "Opportunity"
          WHERE ("expiresAt" IS NULL OR "expiresAt" > ${now})
            AND id > ${lastId}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw`
          SELECT id, title, description, "descriptionIt"
          FROM "Opportunity"
          WHERE ("expiresAt" IS NULL OR "expiresAt" > ${now})
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `;

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          const result = await translateOpportunityToItalian(opp.title, opp.description);
          if (!result) {
            failed++;
            return;
          }
          try {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: {
                titleIt: result.title,
                // Only overwrite descriptionIt if it was missing
                ...(!opp.descriptionIt ? { descriptionIt: result.description } : {}),
              },
            });
            updated++;
          } catch {
            failed++;
          }
        }),
      );
      if (i + CONCURRENCY < batch.length) {
        await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${total} (updated=${updated} failed=${failed})`);
  }

  console.log(`Done. updated=${updated} failed=${failed} total=${processed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
