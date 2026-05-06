import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export function calculateRetentionCutoff(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

async function cleanRejectedFriendRequests(): Promise<number> {
  const cutoff = calculateRetentionCutoff(30);
  const result = await prisma.friendRequest.deleteMany({
    where: {
      status: 'REJECTED',
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}

async function cleanOldMessages(): Promise<number> {
  const cutoff = calculateRetentionCutoff(730);
  const result = await prisma.pathMatesMessage.deleteMany({
    where: {
      sentAt: { lt: cutoff },
    },
  });
  return result.count;
}

export async function runRetentionCleanup(): Promise<void> {
  logger.info('Running data retention cleanup...');
  try {
    const [friendRequests, messages] = await Promise.all([
      cleanRejectedFriendRequests(),
      cleanOldMessages(),
    ]);
    logger.info(`Retention cleanup complete: deleted ${friendRequests} rejected friend requests, ${messages} old messages`);
  } catch (err) {
    logger.error('Retention cleanup failed', err);
  }
}

export function startRetentionCleanupJob(): void {
  cron.schedule('0 3 1 * *', runRetentionCleanup, { timezone: 'Europe/Rome' });
  logger.info('Data retention cleanup job scheduled (monthly, 03:00 on 1st)');
}
