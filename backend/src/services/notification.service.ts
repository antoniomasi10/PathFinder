import prisma from '../lib/prisma';
import { NotificationType } from '@prisma/client';

export async function createNotification(
  userId: string,
  type: NotificationType,
  content: string,
  linkTo?: string
) {
  return prisma.notification.create({
    data: { userId, type, content, linkTo },
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
