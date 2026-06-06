import cron from 'node-cron';
import prisma from '../lib/prisma';
import { createNotification } from './notification.service';
import { scoreOpportunity, parseUserSkills } from './matchingEngine';
import { logger } from '../utils/logger';

export function startDailyOpportunityNotifier() {
  cron.schedule('30 9 * * *', async () => {
    try {
      await sendDailyOpportunityNotifications();
    } catch (err) {
      logger.error('Daily opportunity notifier error', { error: String(err) });
    }
  });

  logger.info('Daily opportunity notifier started (runs at 09:30 every day)');
}

async function sendDailyOpportunityNotifications() {
  const [opportunities, users] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about",
              o."url", o."type", o."universityId", o."company", o."organizer", o."location",
              o."isRemote", o."isAbroad", o."requiredEnglishLevel", o."minGpa", o."tags",
              o."deadline", o."postedAt", o."expiresAt", o."source", o."sourceId",
              o."eligibleFields", o."country", o."city", o."region", o."format",
              o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
              o."cost", o."hasScholarship", o."requiredSkills", o."recommendedSkills"
       FROM "Opportunity" o
       WHERE (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
         AND (o."deadline" IS NULL OR o."deadline" > NOW())
         AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o."source" = 'curated')`,
    ),
    prisma.user.findMany({
      where: { profile: { isNot: null } },
      select: {
        id: true,
        gpa: true,
        englishLevel: true,
        willingToRelocate: true,
        yearOfStudy: true,
        courseOfStudy: true,
        region: true,
        city: true,
        regionLock: true,
        cityLock: true,
        skills: true,
        profile: true,
      },
    }),
  ]);

  if (opportunities.length === 0 || users.length === 0) {
    logger.info('Daily opportunity notifier: no opportunities or users found, skipping');
    return;
  }

  let sent = 0;

  for (const user of users) {
    if (!user.profile) continue;

    const userSkills = parseUserSkills(user.skills);

    let bestOpp: any = null;
    let bestScore = 0;

    for (const opp of opportunities) {
      const score = scoreOpportunity(user.profile as any, user as any, opp, userSkills);
      if (score > bestScore) {
        bestScore = score;
        bestOpp = opp;
      }
    }

    if (!bestOpp || bestScore === 0) continue;

    const source = bestOpp.company || bestOpp.organizer;
    const content = source
      ? `${bestOpp.title} di ${source} — la tua opportunità di oggi`
      : `${bestOpp.title} — la tua opportunità di oggi`;

    await createNotification(user.id, 'NEW_OPPORTUNITY', content, '/opportunities', '💼', {
      opportunityId: bestOpp.id,
      matchScore: bestScore,
    });

    sent++;
  }

  logger.info(`Daily opportunity notifier: sent ${sent} notifications`);
}
