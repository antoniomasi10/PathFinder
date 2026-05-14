/**
 * Diagnostica per la sparizione di opportunità (es. "We Make Future").
 *
 * Stampa un report con:
 *   1. La riga WMF (se esiste in DB) con tutti i campi rilevanti per il filtro.
 *   2. Conteggio righe con deadline / expiresAt nel passato, raggruppate per source.
 *   3. Conteggio righe con urlStatus='BROKEN', raggruppate per source.
 *   4. Lista degli sourceId del seed curato che NON sono più presenti in DB.
 *   5. Righe curated con deadline o expiresAt nel passato (sospetti #1/#4).
 *
 * Read-only: non modifica il database.
 *
 * Uso:
 *   npx ts-node --transpile-only backend/scripts/diagnose-missing-opportunities.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';

const EXPECTED_CURATED_SOURCE_IDS = [
  'curated-wmf-2026',
  'curated-hfarm-openday',
  'curated-smau-milano-2026',
  'curated-codemotion-milan-2026',
];

function hr(title: string) {
  console.log('\n' + '─'.repeat(70));
  console.log(title);
  console.log('─'.repeat(70));
}

async function main() {
  hr('1. Riga "We Make Future"');
  const wmf = await prisma.$queryRaw<any[]>`
    SELECT id, title, source, "sourceId", verified, "urlStatus",
           deadline, "expiresAt", "startDate", "endDate",
           "postedAt", "lastSyncedAt",
           "structuredContent"->>'deadline' AS ai_deadline
    FROM "Opportunity"
    WHERE title ILIKE '%we make future%' OR "sourceId" = 'curated-wmf-2026'
  `;
  if (wmf.length === 0) {
    console.log('❌ NESSUNA riga "We Make Future" trovata in DB.');
    console.log('   → Probabile cancellazione da cleanup.service (Suspect #2).');
  } else {
    for (const r of wmf) {
      console.log(JSON.stringify(r, null, 2));
      const now = new Date();
      const issues: string[] = [];
      if (r.deadline && new Date(r.deadline) <= now) issues.push(`deadline ${r.deadline} ≤ now`);
      if (r.expiresAt && new Date(r.expiresAt) <= now) issues.push(`expiresAt ${r.expiresAt} ≤ now`);
      if (r.urlStatus === 'BROKEN') issues.push(`urlStatus=BROKEN`);
      console.log(issues.length ? `→ FILTRATA per: ${issues.join(', ')}` : '→ Nessun filtro hard la esclude. Indagare profilo utente / filtri soft.');
    }
  }

  hr('2. Righe con deadline o expiresAt nel passato, per source');
  const pastDeadline = await prisma.$queryRaw<any[]>`
    SELECT source, COUNT(*)::int AS n
    FROM "Opportunity"
    WHERE deadline < NOW()
    GROUP BY source ORDER BY n DESC
  `;
  console.log('Past deadline:'); console.table(pastDeadline);

  const pastExpires = await prisma.$queryRaw<any[]>`
    SELECT source, COUNT(*)::int AS n
    FROM "Opportunity"
    WHERE "expiresAt" < NOW()
    GROUP BY source ORDER BY n DESC
  `;
  console.log('Past expiresAt:'); console.table(pastExpires);

  hr('3. Righe con urlStatus=BROKEN');
  const broken = await prisma.$queryRaw<any[]>`
    SELECT source, COUNT(*)::int AS n
    FROM "Opportunity"
    WHERE "urlStatus" = 'BROKEN'
    GROUP BY source ORDER BY n DESC
  `;
  console.table(broken);

  hr('4. SourceId curati attesi vs presenti');
  const presentRows = await prisma.opportunity.findMany({
    where: { source: 'curated', sourceId: { in: EXPECTED_CURATED_SOURCE_IDS } },
    select: { sourceId: true },
  });
  const presentSet = new Set(presentRows.map((r) => r.sourceId));
  const missing = EXPECTED_CURATED_SOURCE_IDS.filter((id) => !presentSet.has(id));
  console.log(`Presenti: ${presentSet.size}/${EXPECTED_CURATED_SOURCE_IDS.length}`);
  if (missing.length) {
    console.log('❌ MANCANTI:'); missing.forEach((m) => console.log('   - ' + m));
    console.log('   → Rilanciare seed: npx ts-node --transpile-only backend/prisma/seeds/curated-events-2026.ts');
  } else {
    console.log('✅ Tutti i curated sono presenti.');
  }

  hr('5. Righe curated con deadline/expiresAt passati (Suspect #1 / #4)');
  const corruptedCurated = await prisma.$queryRaw<any[]>`
    SELECT id, title, "sourceId", deadline, "expiresAt",
           "structuredContent"->>'deadline' AS ai_deadline
    FROM "Opportunity"
    WHERE source = 'curated'
      AND (deadline < NOW() OR "expiresAt" < NOW())
  `;
  if (corruptedCurated.length === 0) {
    console.log('✅ Nessuna riga curated ha deadline/expiresAt nel passato.');
  } else {
    console.log(`❌ ${corruptedCurated.length} righe curated con date corrotte:`);
    console.table(corruptedCurated);
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
