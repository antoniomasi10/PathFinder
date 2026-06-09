// Usage: npx ts-node -r tsconfig-paths/register src/scripts/sendTestEmails.ts
// Sends one test email of each type to the target user, ignoring schedule/dedup.

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../lib/prisma';
import { getHybridMatchedOpportunities, scoreOpportunity, parseUserSkills } from '../services/matchingEngine';
import {
  renderDailyOpportunity,
  renderWeeklyDigest,
  renderExpiringAlert,
  renderSpotRecommendation,
} from '../services/emailTemplates.service';
import { sendEmailToUser } from '../services/oneSignal.service';

const TARGET_EMAIL = 'mmodugno51@gmail.com';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PREFS_URL = `${APP_URL}/profile#notifications`;

function toCard(o: any) {
  return {
    id: o.id,
    title: o.title,
    company: o.company ?? null,
    organizer: o.organizer ?? null,
    city: o.city ?? null,
    isRemote: o.isRemote ?? false,
    deadline: o.deadline ? new Date(o.deadline) : null,
    hasScholarship: o.hasScholarship ?? false,
    type: o.type,
    matchScore: Math.round(o.matchScore ?? o.hybridScore ?? 0),
    url: o.url ?? null,
  };
}

async function main() {
  // Ensure user is in the mailing list
  await prisma.user.update({
    where: { email: TARGET_EMAIL },
    data: { marketingConsent: true },
  });
  console.log(`✓ marketingConsent set to true for ${TARGET_EMAIL}`);

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true, name: true, profile: true, skills: true,
      gpa: true, englishLevel: true, willingToRelocate: true,
      yearOfStudy: true, courseOfStudy: true,
      region: true, city: true, regionLock: true, cityLock: true,
    },
  });
  if (!user) throw new Error(`User ${TARGET_EMAIL} not found`);
  console.log(`Sending test emails to ${user.name} <${TARGET_EMAIL}>\n`);

  // ── 1. Daily Opportunity ───────────────────────────────────────
  const { data: rawOpps } = await getHybridMatchedOpportunities(user.id, 5, 0);
  const dailyOpps = rawOpps
    .filter((o: any) => (o.matchScore ?? o.hybridScore ?? 0) >= 1)
    .slice(0, 3)
    .map(toCard);

  if (dailyOpps.length > 0) {
    const { subject, html } = renderDailyOpportunity({
      firstName: user.name,
      opportunities: dailyOpps,
      appUrl: APP_URL,
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: PREFS_URL,
    });
    await sendEmailToUser(user.id, subject, html);
    console.log('✓ [1/4] Daily opportunity sent');
  } else {
    console.log('✗ [1/4] Daily opportunity skipped — no opportunities found');
  }

  // ── 2. Weekly Digest ───────────────────────────────────────────
  const { data: rawDigest } = await getHybridMatchedOpportunities(user.id, 7, 0);
  const digestOpps = rawDigest
    .filter((o: any) => (o.matchScore ?? o.hybridScore ?? 0) >= 1)
    .slice(0, 7)
    .map(toCard);

  if (digestOpps.length >= 2) {
    const { subject, html } = renderWeeklyDigest({
      firstName: user.name,
      opportunities: digestOpps,
      appUrl: APP_URL,
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: PREFS_URL,
    });
    await sendEmailToUser(user.id, subject, html);
    console.log('✓ [2/4] Weekly digest sent');
  } else {
    console.log('✗ [2/4] Weekly digest skipped — not enough opportunities');
  }

  // ── 3. Expiring Alert ──────────────────────────────────────────
  // Use any saved opportunities with a future deadline; fall back to any upcoming opp.
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let expiringOpps: any[] = await prisma.$queryRawUnsafe(
    `SELECT o.id, o.title, o.company, o.organizer, o.city, o."isRemote",
            o.deadline, o."hasScholarship", o.type::text
     FROM "_SavedOpportunities" so
     JOIN "Opportunity" o ON o.id = so."B"
     WHERE so."A" = $1
       AND o.deadline IS NOT NULL
       AND o.deadline > $2
     ORDER BY o.deadline ASC
     LIMIT 3`,
    user.id, now,
  );

  // Fallback: any upcoming opportunity
  if (expiringOpps.length === 0) {
    expiringOpps = await prisma.$queryRawUnsafe(
      `SELECT id, title, company, organizer, city, "isRemote",
              deadline, "hasScholarship", type::text
       FROM "Opportunity"
       WHERE deadline IS NOT NULL AND deadline > $1 AND deadline < $2
       ORDER BY deadline ASC
       LIMIT 3`,
      now, in30d,
    );
  }

  if (expiringOpps.length > 0) {
    const { subject, html } = renderExpiringAlert({
      firstName: user.name,
      opportunities: expiringOpps.map((o: any) => ({
        id: o.id,
        title: o.title,
        company: o.company ?? null,
        organizer: o.organizer ?? null,
        city: o.city ?? null,
        isRemote: o.isRemote ?? false,
        deadline: o.deadline ? new Date(o.deadline) : null,
        hasScholarship: o.hasScholarship ?? false,
        type: o.type,
      })),
      appUrl: APP_URL,
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: PREFS_URL,
    });
    await sendEmailToUser(user.id, subject, html);
    console.log('✓ [3/4] Expiring alert sent');
  } else {
    console.log('✗ [3/4] Expiring alert skipped — no upcoming deadlines found');
  }

  // ── 4. Spot Recommendation ─────────────────────────────────────
  // Use best match from recent opportunities (last 7 days); fall back to any.
  const in7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let spotOpps: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, title, company, organizer, city, "isRemote",
            deadline, "hasScholarship", type::text, "postedAt"
     FROM "Opportunity"
     WHERE "postedAt" >= $1
       AND (deadline IS NULL OR deadline > $2)
     ORDER BY "postedAt" DESC
     LIMIT 10`,
    in7d, now,
  );

  if (spotOpps.length === 0) {
    spotOpps = await prisma.$queryRawUnsafe(
      `SELECT id, title, company, organizer, city, "isRemote",
              deadline, "hasScholarship", type::text
       FROM "Opportunity"
       WHERE (deadline IS NULL OR deadline > $1)
       ORDER BY "postedAt" DESC
       LIMIT 10`,
      now,
    );
  }

  if (spotOpps.length > 0) {
    const userSkills = parseUserSkills(user.skills);
    let best = spotOpps[0];
    let bestScore = 0;
    if (user.profile) {
      for (const opp of spotOpps) {
        const score = scoreOpportunity(user.profile as any, user as any, opp as any, userSkills);
        if (score > bestScore) { bestScore = score; best = opp; }
      }
    }
    const matchScore = Math.round(bestScore);
    const { subject, html } = renderSpotRecommendation({
      firstName: user.name,
      opportunity: {
        id: best.id,
        title: best.title,
        company: best.company ?? null,
        organizer: best.organizer ?? null,
        city: best.city ?? null,
        isRemote: best.isRemote ?? false,
        deadline: best.deadline ? new Date(best.deadline) : null,
        hasScholarship: best.hasScholarship ?? false,
        type: best.type,
        matchScore,
      },
      matchScore,
      appUrl: APP_URL,
      preferencesUrl: PREFS_URL,
      unsubscribeUrl: PREFS_URL,
    });
    await sendEmailToUser(user.id, subject, html);
    console.log('✓ [4/4] Spot recommendation sent');
  } else {
    console.log('✗ [4/4] Spot recommendation skipped — no opportunities found');
  }

  console.log('\nDone.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
