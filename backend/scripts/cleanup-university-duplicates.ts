// Usage: npx ts-node backend/scripts/cleanup-university-duplicates.ts

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';

async function main() {
  const universities = await prisma.university.findMany({
    orderBy: { name: 'asc' },
  });

  // Group by normalized name
  const groups = new Map<string, typeof universities>();
  for (const u of universities) {
    const key = u.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(u);
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('Nessun duplicato trovato.');
    return;
  }

  console.log(`Trovati ${duplicateGroups.length} gruppi con duplicati.\n`);

  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    // Keep the seed version (sourceId === null); fallback to first by createdAt
    const toKeep =
      group.find((u) => u.sourceId === null) ??
      group.sort((a, b) => (a.id < b.id ? -1 : 1))[0];

    const toDelete = group.filter((u) => u.id !== toKeep.id);

    console.log(`"${toKeep.name}"`);
    console.log(`  Mantenuto:  ${toKeep.id} (sourceId=${toKeep.sourceId ?? 'null'})`);

    for (const dup of toDelete) {
      const [users, courses, opportunities] = await Promise.all([
        prisma.user.updateMany({
          where: { universityId: dup.id },
          data: { universityId: toKeep.id },
        }),
        prisma.course.updateMany({
          where: { universityId: dup.id },
          data: { universityId: toKeep.id },
        }),
        prisma.opportunity.updateMany({
          where: { universityId: dup.id },
          data: { universityId: toKeep.id },
        }),
      ]);

      await prisma.university.delete({ where: { id: dup.id } });

      console.log(
        `  Eliminato:  ${dup.id} (sourceId=${dup.sourceId ?? 'null'}) — ` +
        `spostati: ${users.count} utenti, ${courses.count} corsi, ${opportunities.count} opportunità`
      );
      totalDeleted++;
    }
    console.log('');
  }

  console.log(`Cleanup completato. Record eliminati: ${totalDeleted}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
