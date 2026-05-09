/**
 * Backfills structuredContent for existing opportunities that have not been AI-parsed yet.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/backfill-structured-content.ts
 *
 * Processes records in batches of 20 (concurrency 5) to stay within OpenAI rate limits.
 * Safe to run multiple times — only processes records where structuredContent IS NULL.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { parseOpportunityContent } from '../src/services/ai/opportunityParser';

const BATCH_SIZE = 20;
const CONCURRENCY = 3;
const CHUNK_DELAY_MS = 700; // ~260 req/min — well within GPT-4o Mini 500 RPM limit

type OppRow = { id: string; title: string; description: string; about: string | null; company: string | null };

async function main() {
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count FROM "Opportunity" WHERE "structuredContent" IS NULL
  `;
  const total = Number(count);
  console.log(`Found ${total} opportunities to backfill`);

  if (total === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let lastId = '';

  while (processed < total) {
    const batch: OppRow[] = lastId
      ? await prisma.$queryRaw`
          SELECT id, title, description, about, company
          FROM "Opportunity"
          WHERE "structuredContent" IS NULL AND id > ${lastId}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw`
          SELECT id, title, description, about, company
          FROM "Opportunity"
          WHERE "structuredContent" IS NULL
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `;

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          const structured = await parseOpportunityContent(opp.title, opp.description, opp.about, opp.company);
          if (structured) {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: { structuredContent: structured as any },
            }).catch(() => {});
          }
        }),
      );
      if (i + CONCURRENCY < batch.length) {
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${total}`);
  }

  console.log(`Done. Processed ${processed} opportunities.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
