import cron from 'node-cron';
import prisma from '../lib/prisma';
import { createNotification } from './notification.service';

export function startDeadlineChecker() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await checkOpportunityDeadlines();
      await checkCourseDeadlines();
    } catch (err) {
      console.error('Deadline checker error:', err);
    }
  });

  console.log('Deadline checker started (runs every hour)');
}

async function checkOpportunityDeadlines() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find opportunities with deadlines in 7 days (window: 7d ± 30min)
  const sevenDayWindow = {
    gte: new Date(in7d.getTime() - 30 * 60 * 1000),
    lte: new Date(in7d.getTime() + 30 * 60 * 1000),
  };

  // Find opportunities with deadlines in 24 hours (window: 24h ± 30min)
  const oneDayWindow = {
    gte: new Date(in24h.getTime() - 30 * 60 * 1000),
    lte: new Date(in24h.getTime() + 30 * 60 * 1000),
  };

  const [sevenDayOpps, oneDayOpps] = await Promise.all([
    prisma.opportunity.findMany({
      where: { deadline: sevenDayWindow },
      include: { savedBy: { select: { id: true } } },
    }),
    prisma.opportunity.findMany({
      where: { deadline: oneDayWindow },
      include: { savedBy: { select: { id: true } } },
    }),
  ]);

  for (const opp of sevenDayOpps) {
    for (const user of opp.savedBy) {
      await createNotification(
        user.id,
        'OPPORTUNITY_DEADLINE',
        `"${opp.title}" scade tra 7 giorni`,
        `/home`,
        undefined,
        { opportunityId: opp.id, daysLeft: 7 }
      );
    }
  }

  for (const opp of oneDayOpps) {
    for (const user of opp.savedBy) {
      await createNotification(
        user.id,
        'OPPORTUNITY_DEADLINE',
        `"${opp.title}" scade tra 24 ore!`,
        `/home`,
        undefined,
        { opportunityId: opp.id, daysLeft: 1 }
      );
    }
  }
}

async function checkCourseDeadlines() {
  // Courses don't have deadlines in schema, but we can notify about
  // recommended courses based on saved courses. This is a placeholder
  // that can be extended when course deadlines are added.
}
