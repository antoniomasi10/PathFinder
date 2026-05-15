import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { logger } from '../utils/logger';
import { getHybridMatchedOpportunities } from './matchingEngine';
import { renderWeeklyDigest, renderExpiringAlert } from './emailTemplates.service';
import nodemailer from 'nodemailer';

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'COhA';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'info@cohaapp.com';

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

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

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) return;
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

async function logEmailSent(userId: string, type: string, weekNumber?: number, year?: number): Promise<void> {
  await prisma.emailLog.create({
    data: { userId, type, weekNumber, year },
  });
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
    select: { id: true, email: true, name: true },
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

          await sendEmail(user.email, subject, html);
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

  // Fetch users with saved opportunities expiring in 5-7 days
  // who haven't already been alerted today and have opted in
  const rows = await prisma.$queryRawUnsafe<
    Array<{ userId: string; email: string; name: string; oppId: string; title: string; company: string | null; organizer: string | null; city: string | null; isRemote: boolean; deadline: Date; hasScholarship: boolean; type: string }>
  >(
    `SELECT u.id as "userId", u.email, u.name,
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

  // Group by user
  const byUser = new Map<string, { email: string; name: string; opps: any[] }>();
  for (const row of rows) {
    if (!byUser.has(row.userId)) {
      byUser.set(row.userId, { email: row.email, name: row.name, opps: [] });
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
      batch.map(async ([userId, { email, name, opps }]) => {
        try {
          const { subject, html } = renderExpiringAlert({
            firstName: name,
            opportunities: opps,
            appUrl: APP_URL,
            preferencesUrl: `${APP_URL}/profile#notifications`,
            unsubscribeUrl: `${APP_URL}/profile#notifications`,
          });
          await sendEmail(email, subject, html);
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
