import prisma from '../lib/prisma';
import { NotificationType } from '@prisma/client';

function isValidLinkTo(linkTo?: string): string | undefined {
  if (!linkTo) return undefined;
  // Only allow relative paths starting with /
  if (!linkTo.startsWith('/')) return undefined;
  // Block javascript: and data: protocols that could be embedded
  if (linkTo.includes(':')) return undefined;
  return linkTo;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  content: string,
  linkTo?: string
) {
  return prisma.notification.create({
    data: { userId, type, content, linkTo: isValidLinkTo(linkTo) },
  });
}

export async function getNotifications(userId: string, page: number = 1, limit: number = 20) {
  limit = Math.min(limit, 50);
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { data: notifications, total, page, totalPages: Math.ceil(total / limit) };
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
