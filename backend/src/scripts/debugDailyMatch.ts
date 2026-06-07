/**
 * Read-only diagnostic script — shows scoring breakdown for the top candidates
 * that would appear as "opportunity of the day" for a given user.
 *
 * Usage:
 *   DATABASE_URL=<prod_url> npx ts-node backend/src/scripts/debugDailyMatch.ts <email>
 *   (or set DATABASE_URL in backend/.env and run without the prefix)
 *
 * Output: user profile summary, top 10 scored candidates with step-by-step trace.
 */
import prisma from '../lib/prisma';
import { getNewOpportunitiesFull, scoreOpportunity, parseUserSkills } from '../services/matchingEngine';
import type { ScoreTrace } from '../services/matchingEngine';
import { normalizeFieldToEnum } from '../services/import/utils';

const email = process.argv[2];
if (!email) {
  console.error('Usage: ts-node debugDailyMatch.ts <email>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log('\n=== PROFILO UTENTE ===');
  console.log(`Name:              ${user.name} ${user.surname}`);
  console.log(`courseOfStudy:     ${user.courseOfStudy ?? '(non impostato)'}`);
  console.log(`fieldNormalized:   ${user.courseOfStudy ? normalizeFieldToEnum(user.courseOfStudy) : 'N/A'}`);
  console.log(`gpa:               ${user.gpa ?? '(non impostato)'}`);
  console.log(`englishLevel:      ${user.englishLevel ?? '(non impostato)'}`);
  console.log(`willingToRelocate: ${user.willingToRelocate ?? '(non impostato)'}`);
  console.log(`yearOfStudy:       ${user.yearOfStudy ?? '(non impostato)'}`);

  if (user.profile) {
    const p = user.profile as any;
    console.log(`primaryInterest:   ${p.primaryInterest ?? '(non impostato)'}`);
    console.log(`passions:          ${JSON.stringify(p.passions ?? [])}`);
    console.log(`clusterTag:        ${p.clusterTag ?? '(non impostato)'}`);
  } else {
    console.log('(nessun profilo onboarding trovato — feed mostrerà opportunità per data)');
  }

  console.log('\n=== TOP 10 CANDIDATI "OPPORTUNITÀ DEL GIORNO" ===');

  const allOpps = await getNewOpportunitiesFull(user.id, {});

  if (allOpps.length === 0) {
    console.log('Nessuna opportunità trovata.');
    await prisma.$disconnect();
    return;
  }

  const userSkills = parseUserSkills(user.skills);
  const top10 = [...allOpps].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, 10);

  for (let i = 0; i < top10.length; i++) {
    const opp = top10[i];
    console.log(`\n--- #${i + 1} ---`);
    console.log(`Title:          ${opp.title}`);
    console.log(`Type:           ${opp.type}`);
    console.log(`Company:        ${opp.company ?? '(nessuna)'}`);
    console.log(`tags:           [${(opp.tags ?? []).join(', ')}]`);
    console.log(`eligibleFields: [${(opp.eligibleFields ?? []).join(', ')}]`);
    console.log(`matchScore:     ${opp.matchScore}`);

    if (user.profile) {
      const trace: ScoreTrace = [];
      const recomputedScore = scoreOpportunity(user.profile, user, opp as any, userSkills, trace);
      console.log(`recomputedScore: ${recomputedScore}`);
      console.log('Trace:');
      for (const entry of trace) {
        const applied = entry.detail.startsWith('PENALTY') || entry.detail.startsWith('SKIP') ? '' : '';
        console.log(`  [${entry.step}] ${entry.detail} → score=${entry.scoreAfter}`);
      }

      if (i === 0) {
        console.log('\n=== RIEPILOGO PENALITÀ CANDIDATO #1 ===');
        const skippedPenalties = trace.filter(e => e.step.match(/step1[3-9]|step16|step18/) && e.detail.startsWith('SKIP'));
        const appliedPenalties = trace.filter(e => e.step.match(/step1[3-9]|step16|step18/) && e.detail.startsWith('PENALTY'));
        if (appliedPenalties.length > 0) {
          console.log('Penalità applicate:');
          appliedPenalties.forEach(e => console.log(`  ✓ [${e.step}] ${e.detail}`));
        }
        if (skippedPenalties.length > 0) {
          console.log('Penalità saltate (causa potenziale del bug):');
          skippedPenalties.forEach(e => console.log(`  ✗ [${e.step}] ${e.detail}`));
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
