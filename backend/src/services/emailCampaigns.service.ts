import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { logger } from '../utils/logger';
import { getHybridMatchedOpportunities, scoreOpportunity } from './matchingEngine';
import {
  renderWeeklyDigest,
  renderExpiringAlert,
  renderDailyOpportunity,
  renderSpotRecommendation,
} from './emailTemplates.service';
import { sendEmailToUser } from './oneSignal.service';
import type { UserSkills } from './skills.service';

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function logEmailSent(userId: string, type: string, weekNumber?: number, year?: number): Promise<void> {
  await prisma.emailLog.create({
    data: { userId, type, weekNumber, year },
  });
}

function parseUserSkills(raw: unknown): UserSkills | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    core: Array.isArray(obj.core) ? obj.core : null,
    side: Array.isArray(obj.side) ? obj.side : [],
    promptShownAt: (obj.promptShownAt as string) || null,
    promptDismissedAt: (obj.promptDismissedAt as string) || null,
    definedAt: (obj.definedAt as string) || null,
    lastUpdatedAt: (obj.lastUpdatedAt as string) || null,
  };
}

// ── Weekly Digest ────────────────────────────────────────────

export async function runWeeklyDigest(): Promise<void> {
  const { week, year } = getISOWeek(new Date());
  const lockKey = `campaign:weekly_digest:${year}:${week}`;

  if (!(await acquireLock(lockKey, 7200))) {
    logger.info('Weekly digest already running on another instance, skipping');
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      emailVerified: true,
      marketingConsent: true,
      profileCompleted: true,
      notificationPreference: {
        emailDigest: true,
      },
      emailLogs: {
        none: {
          type: 'weekly_digest',
          weekNumber: week,
          year: year,
        },
      },
    },
    select: { id: true, name: true },
  });

  logger.info('Weekly digest targets', { count: users.length, week, year });

  const BATCH = 50;
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const { data: rawOpps } = await getHybridMatchedOpportunities(user.id, 7, 0);
          const opps = rawOpps
            .filter((o: any) => (o.matchScore ?? o.hybridScore ?? 0) >= 50)
            .slice(0, 7)
            .map((o: any) => ({
              id: o.id,
              title: o.title,
              company: o.company,
              organizer: o.organizer,
              city: o.city,
              isRemote: o.isRemote ?? false,
              deadline: o.deadline ? new Date(o.deadline) : null,
              hasScholarship: o.hasScholarship ?? false,
              type: o.type,
              matchScore: Math.round(o.matchScore ?? o.hybridScore ?? 0),
              url: o.url,
            }));

          if (opps.length < 2) { skipped++; return; }

          const { subject, html } = renderWeeklyDigest({
            firstName: user.name,
            opportunities: opps,
            appUrl: APP_URL,
            preferencesUrl: `${APP_URL}/profile#notifications`,
            unsubscribeUrl: `${APP_URL}/profile#notifications`,
          });

          await sendEmailToUser(user.id, subject, html);
          await logEmailSent(user.id, 'weekly_digest', week, year);
          sent++;
        } catch (err) {
          logger.warn('Weekly digest failed for user', { userId: user.id, error: String(err) });
        }
      })
    );
    if (i + BATCH < users.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  logger.info('Weekly digest complete', { sent, skipped, total: users.length });
}

// ── Expiring Alert ───────────────────────────────────────────

export async function runExpiringAlert(): Promise<void> {
  const lockKey = `campaign:expiring_alert:${new Date().toISOString().slice(0, 10)}`;

  if (!(await acquireLock(lockKey, 3600))) {
    logger.info('Expiring alert already running on another instance, skipping');
    return;
  }

  const now = new Date();
  const in5d = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rows = await prisma.$queryRawUnsafe<
    Array<{ userId: string; name: string; oppId: string; title: string; company: string | null; organizer: string | null; city: string | null; isRemote: boolean; deadline: Date; hasScholarship: boolean; type: string }>
  >(
    `SELECT u.id as "userId", u.name,
            o.id as "oppId", o.title, o.company, o.organizer, o.city,
            o."isRemote", o.deadline, o."hasScholarship", o.type::text
     FROM "User" u
     JOIN "_SavedOpportunities" so ON so."A" = u.id
     JOIN "Opportunity" o ON o.id = so."B"
     JOIN "NotificationPreference" np ON np."userId" = u.id
     WHERE u."marketingConsent" = true
       AND u."emailVerified" = true
       AND np."emailAlerts" = true
       AND o.deadline >= $1
       AND o.deadline <= $2
       AND NOT EXISTS (
         SELECT 1 FROM "EmailLog" el
         WHERE el."userId" = u.id
           AND el.type = 'expiring_alert'
           AND el."sentAt" >= $3
       )`,
    in5d, in7d, startOfToday
  );

  const byUser = new Map<string, { name: string; opps: any[] }>();
  for (const row of rows) {
    if (!byUser.has(row.userId)) {
      byUser.set(row.userId, { name: row.name, opps: [] });
    }
    byUser.get(row.userId)!.opps.push({
      id: row.oppId,
      title: row.title,
      company: row.company,
      organizer: row.organizer,
      city: row.city,
      isRemote: row.isRemote,
      deadline: row.deadline,
      hasScholarship: row.hasScholarship,
      type: row.type,
    });
  }

  logger.info('Expiring alert targets', { count: byUser.size });

  const BATCH = 50;
  const entries = Array.from(byUser.entries());
  let sent = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async ([userId, { name, opps }]) => {
        try {
          const { subject, html } = renderExpiringAlert({
            firstName: name,
            opportunities: opps,
            appUrl: APP_URL,
            preferencesUrl: `${APP_URL}/profile#notifications`,
            unsubscribeUrl: `${APP_URL}/profile#notifications`,
          });
          await sendEmailToUser(userId, subject, html);
          await logEmailSent(userId, 'expiring_alert');
          sent++;
        } catch (err) {
          logger.warn('Expiring alert failed for user', { userId, error: String(err) });
        }
      })
    );
    if (i + BATCH < entries.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  logger.info('Expiring alert complete', { sent, total: byUser.size });
}

// ── Daily Opportunity ────────────────────────────────────────

export async function runDailyOpportunity(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const lockKey = `campaign:daily_opportunity:${today}`;

  if (!(await acquireLock(lockKey, 3600))) {
    logger.info('Daily opportunity already running on another instance, skipping');
    return;
  }

  const startOfToday = new Date(today);

  const users = await prisma.user.findMany({
    where: {
      emailVerified: true,
      marketingConsent: true,
      profileCompleted: true,
      notificationPreference: {
        emailDigest: true,
      },
      emailLogs: {
        none: {
          type: 'daily_opportunity',
          sentAt: { gte: startOfToday },
        },
      },
    },
    select: { id: true, name: true },
  });

  logger.info('Daily opportunity targets', { count: users.length, date: today });

  const BATCH = 50;
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const { data: rawOpps } = await getHybridMatchedOpportunities(user.id, 5, 0);
          const opps = rawOpps
            .filter((o: any) => (o.matchScore ?? o.hybridScore ?? 0) >= 60)
            .slice(0, 3)
            .map((o: any) => ({
              id: o.id,
              title: o.title,
              company: o.company,
              organizer: o.organizer,
              city: o.city,
              isRemote: o.isRemote ?? false,
              deadline: o.deadline ? new Date(o.deadline) : null,
              hasScholarship: o.hasScholarship ?? false,
              type: o.type,
              matchScore: Math.round(o.matchScore ?? o.hybridScore ?? 0),
              url: o.url,
            }));

          if (opps.length < 1) { skipped++; return; }

          const { subject, html } = renderDailyOpportunity({
            firstName: user.name,
            opportunities: opps,
            appUrl: APP_URL,
            preferencesUrl: `${APP_URL}/profile#notifications`,
            unsubscribeUrl: `${APP_URL}/profile#notifications`,
          });

          await sendEmailToUser(user.id, subject, html);
          await logEmailSent(user.id, 'daily_opportunity');
          sent++;
        } catch (err) {
          logger.warn('Daily opportunity failed for user', { userId: user.id, error: String(err) });
        }
      })
    );
    if (i + BATCH < users.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  logger.info('Daily opportunity complete', { sent, skipped, total: users.length });
}

// ── Spot Recommendation ──────────────────────────────────────

export async function runSpotRecommendation(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const lockKey = `campaign:spot_recommendation:${today}`;

  if (!(await acquireLock(lockKey, 3600))) {
    logger.info('Spot recommendation already running on another instance, skipping');
    return;
  }

  const now = new Date();
  const startOfToday = new Date(today);

  // Fetch opportunities imported today
  const newOpps = await prisma.opportunity.findMany({
    where: {
      postedAt: { gte: startOfToday },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ deadline: null }, { deadline: { gt: now } }] },
      ],
    },
  });

  if (newOpps.length === 0) {
    logger.info('Spot recommendation: no new opportunities today', { date: today });
    return;
  }

  logger.info('Spot recommendation: new opportunities', { count: newOpps.length, date: today });

  // Fetch eligible users with their profile
  const users = await prisma.user.findMany({
    where: {
      emailVerified: true,
      marketingConsent: true,
      profileCompleted: true,
      notificationPreference: {
        emailSpot: true,
      },
      emailLogs: {
        none: {
          type: 'spot_recommendation',
          sentAt: { gte: startOfToday },
        },
      },
    },
    include: {
      profile: true,
    },
  });

  logger.info('Spot recommendation targets', { count: users.length });

  const BATCH = 50;
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (user) => {
        try {
          if (!user.profile) { skipped++; return; }

          const userSkills = parseUserSkills(user.skills);

          // Score each new opportunity for this user
          let bestScore = 0;
          let bestOpp: typeof newOpps[0] | null = null;

          for (const opp of newOpps) {
            const score = scoreOpportunity(user.profile as any, user as any, opp as any, userSkills);
            if (score > bestScore) {
              bestScore = score;
              bestOpp = opp;
            }
          }

          if (bestScore < 80 || !bestOpp) { skipped++; return; }

          const { subject, html } = renderSpotRecommendation({
            firstName: user.name,
            opportunity: {
              id: bestOpp.id,
              title: bestOpp.title,
              company: bestOpp.company,
              organizer: bestOpp.organizer,
              city: bestOpp.city,
              isRemote: bestOpp.isRemote ?? false,
              deadline: bestOpp.deadline ? new Date(bestOpp.deadline) : null,
              hasScholarship: bestOpp.hasScholarship ?? false,
              type: bestOpp.type,
              matchScore: Math.round(bestScore),
              url: bestOpp.url,
            },
            matchScore: Math.round(bestScore),
            appUrl: APP_URL,
            preferencesUrl: `${APP_URL}/settings/security`,
            unsubscribeUrl: `${APP_URL}/settings/security`,
          });

          await sendEmailToUser(user.id, subject, html);
          await logEmailSent(user.id, 'spot_recommendation');
          sent++;
        } catch (err) {
          logger.warn('Spot recommendation failed for user', { userId: user.id, error: String(err) });
        }
      })
    );
    if (i + BATCH < users.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  logger.info('Spot recommendation complete', { sent, skipped, total: users.length });
}
