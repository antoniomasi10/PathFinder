import prisma from '../lib/prisma';
import { NotificationType } from '@prisma/client';
import { shouldNotify } from './notificationPreference.service';
import { getOrCreatePreferences } from './notificationPreference.service';
import { sendPushToUser } from './webPush.service';

// Types that should NOT appear in notification center (chat messages)
const CHAT_ONLY_TYPES: NotificationType[] = ['NEW_MESSAGE'];

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
  linkTo?: string,
  icon?: string,
  data?: Record<string, any>
) {
  // Check user preferences before creating notification
  const allowed = await shouldNotify(userId, type);
  if (!allowed) return null;

  const notification = await prisma.notification.create({
    data: { userId, type, content, linkTo: isValidLinkTo(linkTo), icon, data: data || undefined },
  });

  // Emit real-time event via Socket.IO (will be picked up by the notification namespace)
  try {
    const { getIO } = require('../socketManager');
    const io = getIO();
    if (io) {
      const unreadCount = await getUnreadCount(userId);
      io.of('/notifications').to(`user:${userId}`).emit('new_notification', {
        notification,
        unreadCount,
      });
    }
  } catch {}

  // Send web push notification with rich payload
  try {
    const prefs = await getOrCreatePreferences(userId);
    if (prefs.pushEnabled) {
      await sendPushToUser(userId, {
        body: content,
        icon: icon || undefined,
        url: linkTo || '/notifications',
        type,
        tag: type,
        data: data || {},
      });
    }
  } catch {}

  return notification;
}

export async function getNotifications(userId: string, page: number = 1, limit: number = 20, filter?: string) {
  limit = Math.min(limit, 50);
  const skip = (page - 1) * limit;
  const where: any = { userId };

  // Exclude chat-only types from notification center
  where.type = { notIn: CHAT_ONLY_TYPES };

  if (filter && filter !== 'all') {
    const typeMap: Record<string, NotificationType[]> = {
      unread: [], // handled separately
      networking: ['FRIEND_REQUEST', 'FRIEND_ACCEPTED'],
      opportunities: ['NEW_OPPORTUNITY', 'OPPORTUNITY_DEADLINE'],
      universities: ['COURSE_DEADLINE', 'COURSE_RECOMMENDED'],
      social: ['POST_LIKE', 'POST_COMMENT', 'COMMENT_REPLY'],
    };

    if (filter === 'unread') {
      where.isRead = false;
    } else if (typeMap[filter]) {
      where.type = { in: typeMap[filter] };
    }
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.notification.count({ where }),
  ]);
  return { data: notifications, total, page, totalPages: Math.ceil(total / limit) };
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false, type: { notIn: CHAT_ONLY_TYPES } },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false, type: { notIn: CHAT_ONLY_TYPES } },
  });
}

// Badge counts per tab
export async function getBadgeCounts(userId: string) {
  const [networking, opportunities, chat] = await Promise.all([
    // Networking: pending friend requests + unread networking notifications
    Promise.all([
      prisma.friendRequest.count({
        where: { toUserId: userId, status: 'PENDING' },
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
          type: { in: ['FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'POST_LIKE', 'POST_COMMENT', 'COMMENT_REPLY'] },
        },
      }),
    ]).then(([pending, notifs]) => pending + notifs),

    // Opportunities: unread opportunity notifications
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
        type: { in: ['NEW_OPPORTUNITY', 'OPPORTUNITY_DEADLINE'] },
      },
    }),

    // Chat: unread messages count
    prisma.pathMatesMessage.count({
      where: { receiverId: userId, readAt: null },
    }),
  ]);

  return { networking, opportunities, chat };
}
