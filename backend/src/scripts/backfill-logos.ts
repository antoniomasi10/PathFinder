/**
 * One-shot script: populates companyLogoUrl for existing opportunities
 * that have a url but no logo yet.
 *
 * Run with: npx ts-node src/scripts/backfill-logos.ts
 */
import prisma from '../lib/prisma';
import { buildClearbitLogoUrl, runWithConcurrency } from '../services/import/utils';

async function main() {
  const opportunities = await prisma.opportunity.findMany({
    where: { companyLogoUrl: null, url: { not: null } },
    select: { id: true, url: true },
  });

  console.log(`Found ${opportunities.length} opportunities to enrich`);

  let updated = 0;
  await runWithConcurrency(opportunities, 10, async (opp) => {
    const logoUrl = buildClearbitLogoUrl(opp.url);
    if (!logoUrl) return;
    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { companyLogoUrl: logoUrl },
    });
    updated++;
  });

  console.log(`Done: ${updated}/${opportunities.length} updated`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
