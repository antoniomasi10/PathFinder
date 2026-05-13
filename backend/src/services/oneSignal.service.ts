import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const APP_ID = process.env.ONESIGNAL_APP_ID || '';
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';
const BASE_URL = 'https://onesignal.com/api/v1';

export function isOneSignalConfigured(): boolean {
  return Boolean(APP_ID && REST_API_KEY);
}

export interface OneSignalPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
}

async function callOneSignal(endpoint: string, body: Record<string, any>): Promise<void> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${REST_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OneSignal API error ${response.status}: ${text}`);
  }
}

// No-op: external user ID linking is not used — we target by player ID directly
export async function setExternalUserId(_playerId: string, _externalUserId: string): Promise<void> {}

export async function sendPushToUser(userId: string, payload: OneSignalPayload): Promise<void> {
  if (!isOneSignalConfigured()) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { oneSignalPlayerId: true } });
    if (!user?.oneSignalPlayerId) return;

    await callOneSignal('/notifications', {
      app_id: APP_ID,
      include_player_ids: [user.oneSignalPlayerId],
      headings: { en: payload.title },
      contents: { en: payload.body },
      url: payload.url,
      data: payload.data,
      priority: payload.priority === 'high' ? 10 : 5,
      ttl: payload.priority === 'high' ? 86400 : 3600,
    });
  } catch (err) {
    logger.warn('OneSignal sendPushToUser failed', { userId, error: String(err) });
  }
}

export async function sendPushToUsers(userIds: string[], payload: OneSignalPayload): Promise<void> {
  if (!isOneSignalConfigured() || userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, oneSignalPlayerId: { not: null } },
      select: { oneSignalPlayerId: true },
    });
    const playerIds = users.map(u => u.oneSignalPlayerId!).filter(Boolean);
    if (playerIds.length === 0) return;

    const CHUNK = 2000;
    for (let i = 0; i < playerIds.length; i += CHUNK) {
      const chunk = playerIds.slice(i, i + CHUNK);
      try {
        await callOneSignal('/notifications', {
          app_id: APP_ID,
          include_player_ids: chunk,
          headings: { en: payload.title },
          contents: { en: payload.body },
          url: payload.url,
          data: payload.data,
          priority: payload.priority === 'high' ? 10 : 5,
          ttl: payload.priority === 'high' ? 86400 : 3600,
        });
      } catch (err) {
        logger.warn('OneSignal sendPushToUsers chunk failed', { chunk: i / CHUNK, error: String(err) });
      }
    }
  } catch (err) {
    logger.warn('OneSignal sendPushToUsers failed', { error: String(err) });
  }
}
