/**
 * Re-runs the AI parser on existing opportunities to:
 *   1) Infer `eligibleFields` (was previously empty for most records — causes the
 *      matching bug where students see opportunities outside their discipline).
 *   2) Refresh `structuredContent` with the new Italian-output, length-constrained prompt.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/reparse-opportunities.ts [--mode <mode>] [--limit N]
 *
 * Modes:
 *   empty-fields  (default) — only opportunities with eligibleFields = '{}'
 *   unparsed              — only opportunities with structuredContent IS NULL
 *   all                   — every opportunity (expensive: full re-parse)
 *
 * Safe to interrupt and resume — each record is updated independently.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { parseOpportunityContent, parseAIDate } from '../src/services/ai/opportunityParser';

const BATCH_SIZE = 40;
const CONCURRENCY = 8;
const CHUNK_DELAY_MS = 200; // Aggressive but well under gpt-4o-mini 500 RPM at typical 2-3s latency

type Mode = 'empty-fields' | 'unparsed' | 'all';
type OppRow = {
  id: string;
  title: string;
  description: string;
  about: string | null;
  company: string | null;
  deadline: Date | null;
  eligibleFields: string[];
};

function parseArgs(): { mode: Mode; limit: number | null } {
  const args = process.argv.slice(2);
  let mode: Mode = 'empty-fields';
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      const m = args[i + 1];
      if (m === 'empty-fields' || m === 'unparsed' || m === 'all') mode = m;
      else throw new Error(`Unknown mode: ${m}`);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { mode, limit };
}

function whereClauseFor(mode: Mode): string {
  switch (mode) {
    case 'empty-fields': return `"eligibleFields" = '{}'`;
    case 'unparsed':     return `"structuredContent" IS NULL`;
    case 'all':          return `TRUE`;
  }
}

async function main() {
  const { mode, limit } = parseArgs();
  const filter = whereClauseFor(mode);
  console.log(`Mode: ${mode}${limit ? ` (limit ${limit})` : ''}`);

  const totalRow = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Opportunity" WHERE ${filter}`,
  );
  const total = limit ? Math.min(limit, Number(totalRow[0].count)) : Number(totalRow[0].count);
  console.log(`Found ${total} opportunities matching filter`);

  if (total === 0) {
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let updatedFields = 0;
  let updatedStructured = 0;
  let errors = 0;
  let lastId = '';

  while (processed < total) {
    const remaining = total - processed;
    const take = Math.min(BATCH_SIZE, remaining);
    const cursor = lastId ? `AND id > '${lastId.replace(/'/g, "''")}'` : '';
    const batch = await prisma.$queryRawUnsafe<OppRow[]>(
      `SELECT id, title, description, about, company, deadline, "eligibleFields"
       FROM "Opportunity"
       WHERE ${filter} ${cursor}
       ORDER BY id
       LIMIT ${take}`,
    );
    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          try {
            const structured = await parseOpportunityContent(opp.title, opp.description, opp.about, opp.company);
            if (!structured) return;

            const updateData: Record<string, unknown> = { structuredContent: structured };
            updatedStructured++;

            if (!opp.deadline && structured.deadline) {
              const extracted = parseAIDate(structured.deadline);
              if (extracted) updateData.deadline = extracted;
            }

            // Only set eligibleFields if currently empty AND the AI inferred something concrete.
            const inferred = structured.eligibleFields.filter(f => f !== 'ANY');
            if (opp.eligibleFields.length === 0 && inferred.length > 0) {
              updateData.eligibleFields = inferred;
              updatedFields++;
            }

            await prisma.opportunity.update({
              where: { id: opp.id },
              data: updateData,
            });
          } catch (err) {
            errors++;
            console.error(`[reparse] error on ${opp.id} (${opp.title}): ${err}`);
          }
        }),
      );
      if (i + CONCURRENCY < batch.length) {
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${total} — structuredContent updated: ${updatedStructured}, eligibleFields inferred: ${updatedFields}, errors: ${errors}`);
  }

  console.log('\nDone.');
  console.log(`  Processed:               ${processed}`);
  console.log(`  structuredContent set:   ${updatedStructured}`);
  console.log(`  eligibleFields inferred: ${updatedFields}`);
  console.log(`  errors:                  ${errors}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
