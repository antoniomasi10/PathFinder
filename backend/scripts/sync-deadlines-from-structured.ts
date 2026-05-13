/**
 * Propagates deadline values already extracted by the AI (stored in structuredContent.deadline)
 * to the dedicated deadline column — no API calls needed.
 *
 * Run this after backfill-structured-content to immediately surface deadlines
 * that the AI found but that weren't written to the deadline column.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/sync-deadlines-from-structured.ts
 *
 * Safe to run multiple times — only touches rows where deadline IS NULL but
 * structuredContent.deadline is set and is a future date.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { parseAIDate } from '../src/services/ai/opportunityParser';

async function main() {
  const rows = await prisma.$queryRaw<{ id: string; aiDeadline: string }[]>`
    SELECT id, "structuredContent"->>'deadline' AS "aiDeadline"
    FROM "Opportunity"
    WHERE deadline IS NULL
      AND "structuredContent" IS NOT NULL
      AND "structuredContent"->>'deadline' IS NOT NULL
  `;

  console.log(`Found ${rows.length} rows with AI-extracted deadline but missing deadline column`);
  if (rows.length === 0) { await prisma.$disconnect(); return; }

  let updated = 0;
  for (const row of rows) {
    const d = parseAIDate(row.aiDeadline);
    if (!d) continue;
    await prisma.opportunity.update({
      where: { id: row.id },
      data: { deadline: d },
    }).catch(() => {});
    updated++;
  }

  console.log(`Done. Updated ${updated} deadlines from structuredContent.`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
