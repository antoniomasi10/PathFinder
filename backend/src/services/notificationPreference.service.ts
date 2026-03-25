import prisma from '../lib/prisma';
import { NotificationType } from '@prisma/client';

const TYPE_TO_PREFERENCE: Record<NotificationType, string> = {
  FRIEND_REQUEST: 'networking',
  FRIEND_ACCEPTED: 'networking',
  NEW_OPPORTUNITY: 'opportunities',
  OPPORTUNITY_DEADLINE: 'opportunities',
  COURSE_DEADLINE: 'universities',
  COURSE_RECOMMENDED: 'universities',
  POST_COMMENT: 'social',
  COMMENT_REPLY: 'social',
  POST_LIKE: 'postLikes',
  NEW_MESSAGE: 'chat',
  BADGE_UNLOCKED: 'achievements',
  SYSTEM: 'system',
  GENERAL: 'system',
  GROUP_UPDATE: 'system',
};

export async function getOrCreatePreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updatePreferences(userId: string, data: Record<string, boolean>) {
  // Only allow known fields
  const allowed = ['pushEnabled', 'networking', 'opportunities', 'universities', 'social', 'postLikes', 'chat', 'achievements', 'system'];
  const filtered: Record<string, boolean> = {};
  for (const key of allowed) {
    if (key in data) filtered[key] = data[key];
  }

  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...filtered },
    update: filtered,
  });
}

export async function shouldNotify(userId: string, type: NotificationType): Promise<boolean> {
  const prefField = TYPE_TO_PREFERENCE[type];
  if (!prefField) return true;

  const prefs = await getOrCreatePreferences(userId);
  return (prefs as any)[prefField] === true;
}
