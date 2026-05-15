// Usage: npx ts-node backend/scripts/backfill-cluster-scores.ts

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { classifyOpportunityCluster } from '../src/services/ai/clusterClassifier';

const CONCURRENCY = 10;

interface OppRow {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[] | null;
  eligibleFields: string[] | null;
}

async function main() {
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count FROM "Opportunity" WHERE "clusterScores" IS NULL
  `;
  const total = Number(count);
  console.log(`Found ${total} opportunities without cluster scores`);

  if (total === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const rows: OppRow[] = await prisma.$queryRaw`
    SELECT id, title, description, type::text, tags, "eligibleFields"::text[] FROM "Opportunity" WHERE "clusterScores" IS NULL
  `;

  let processed = 0;
  let updated = 0;
  const startTime = Date.now();

  async function processOne(opp: OppRow) {
    try {
      const result = await classifyOpportunityCluster({
        title: opp.title,
        description: opp.description,
        type: opp.type,
        tags: opp.tags || [],
        eligibleFields: opp.eligibleFields || [],
      });
      if (result) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { clusterScores: result.scores, clusterPrimary: result.primary },
        });
        updated++;
      }
    } catch (err) {
      console.error(`Error processing opp ${opp.id}:`, err);
    }
    processed++;
    if (processed % 50 === 0) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const rate = processed / elapsedSec;
      const eta = Math.round((total - processed) / rate);
      console.log(`Progress: ${processed}/${total} — updated: ${updated} — ${rate.toFixed(1)}/s — ETA ${eta}s`);
    }
  }

  // Sliding-window concurrency
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processOne));
  }

  console.log(`Done. Processed ${processed} opportunities, updated ${updated} with cluster scores.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
