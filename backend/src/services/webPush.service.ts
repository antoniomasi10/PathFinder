import webpush from 'web-push';
import prisma from '../lib/prisma';
import { NotificationType } from '@prisma/client';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@pathfinder.it';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  });
}

export async function removeSubscription(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ── High-priority notification types ────────────────────────
const HIGH_PRIORITY_TYPES: NotificationType[] = [
  'OPPORTUNITY_DEADLINE',
  'COURSE_DEADLINE',
  'SYSTEM',
];

// ── Titles per notification type ────────────────────────────
const TYPE_TITLES: Partial<Record<NotificationType, string>> = {
  FRIEND_REQUEST: 'Nuova richiesta di connessione',
  FRIEND_ACCEPTED: 'Connessione accettata',
  NEW_MESSAGE: 'Nuovo messaggio',
  NEW_OPPORTUNITY: 'Nuova opportunità',
  OPPORTUNITY_DEADLINE: 'Scadenza in arrivo',
  COURSE_DEADLINE: 'Scadenza corso',
  COURSE_RECOMMENDED: 'Corso consigliato',
  BADGE_UNLOCKED: 'Badge sbloccato!',
  POST_LIKE: 'Nuovo like',
  POST_COMMENT: 'Nuovo commento',
  COMMENT_REPLY: 'Nuova risposta',
  GROUP_UPDATE: 'Aggiornamento gruppo',
  SYSTEM: 'PathFinder',
  GENERAL: 'PathFinder',
};

export interface PushPayload {
  title?: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  type?: NotificationType;
  tag?: string;
  priority?: 'normal' | 'high';
  silent?: boolean;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  // Determine priority from notification type
  const priority =
    payload.priority ||
    (payload.type && HIGH_PRIORITY_TYPES.includes(payload.type) ? 'high' : 'normal');

  // Use type-specific title if none provided
  const title =
    payload.title ||
    (payload.type && TYPE_TITLES[payload.type]) ||
    'PathFinder';

  const pushPayload = JSON.stringify({
    title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    image: payload.image,
    url: payload.url || '/notifications',
    type: payload.type,
    tag: payload.tag || payload.type || 'default',
    priority,
    silent: payload.silent || false,
    data: payload.data || {},
    actions: payload.actions || [],
  });

  const pushOptions: webpush.RequestOptions = {
    TTL: priority === 'high' ? 86400 : 3600, // 24h for high, 1h for normal
    urgency: priority === 'high' ? 'high' : 'normal',
  };

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          pushOptions
        );
      } catch (err: any) {
        // Expired or invalid subscription — clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        throw err;
      }
    })
  );

  return results;
}

export async function sendPushToMultipleUsers(userIds: string[], payload: PushPayload) {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, payload))
  );

  const successCount = results.filter(
    (r) => r.status === 'fulfilled'
  ).length;

  console.log(`Push sent to ${successCount}/${userIds.length} users`);
  return results;
}
