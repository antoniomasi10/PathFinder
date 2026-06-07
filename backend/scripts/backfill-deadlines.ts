/**
 * Backfills deadline for opportunities that currently have deadline=NULL.
 *
 * Uses the lightweight extractDeadlineFromText() — one focused API call per opportunity,
 * much cheaper than re-running the full structuredContent parser.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/backfill-deadlines.ts
 *
 * Safe to run multiple times — only processes records where deadline IS NULL.
 * TIROCINIO is included: the AI returns null if no deadline is in the text.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { extractDeadlineFromText } from '../src/services/ai/opportunityParser';

const BATCH_SIZE = 20;
const CONCURRENCY = 3;
const CHUNK_DELAY_MS = 700;

type OppRow = { id: string; title: string; description: string; about: string | null };

async function main() {
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count FROM "Opportunity" WHERE deadline IS NULL
  `;
  const total = Number(count);
  console.log(`Found ${total} opportunities without deadline`);

  if (total === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let found = 0;
  let lastId = '';

  while (processed < total) {
    const batch: OppRow[] = lastId
      ? await prisma.$queryRaw`
          SELECT id, title, description, about
          FROM "Opportunity"
          WHERE deadline IS NULL AND id > ${lastId}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw`
          SELECT id, title, description, about
          FROM "Opportunity"
          WHERE deadline IS NULL
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `;

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          const deadline = await extractDeadlineFromText(opp.title, opp.description, opp.about);
          if (deadline) {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: { deadline },
            }).catch(() => {});
            found++;
          }
        }),
      );
      if (i + CONCURRENCY < batch.length) {
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${total} — deadlines found so far: ${found}`);
  }

  console.log(`Done. Processed ${processed} opportunities, extracted ${found} deadlines.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
