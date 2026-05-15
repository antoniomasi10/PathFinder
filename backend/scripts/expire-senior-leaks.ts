// Usage: npx ts-node backend/scripts/expire-senior-leaks.ts
// One-shot cleanup: expires INTERNSHIP/STAGE rows whose title matches the senior heuristic.
// Reuses isSeniorRole() from import/utils so logic stays in one place.

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { isSeniorRole } from '../src/services/import/utils';

async function main() {
  const rows = await prisma.opportunity.findMany({
    where: {
      type: { in: ['INTERNSHIP', 'STAGE'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, title: true },
  });

  const targets = rows.filter((r) => isSeniorRole(r.title));
  console.log(`[expire-senior-leaks] candidates: ${rows.length}, senior leaks: ${targets.length}`);

  if (targets.length === 0) {
    await prisma.$disconnect();
    process.exit(0);
  }

  const now = new Date();
  await prisma.opportunity.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { expiresAt: now },
  });
  console.log(`[expire-senior-leaks] expired ${targets.length} rows`);
  console.log('Sample (first 10):');
  for (const t of targets.slice(0, 10)) console.log(`  - ${t.title}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[expire-senior-leaks] error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
