import { logger } from '../utils/logger';

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

export async function setExternalUserId(playerId: string, externalUserId: string): Promise<void> {
  if (!isOneSignalConfigured()) return;
  try {
    await callOneSignal(`/players/${playerId}`, {
      app_id: APP_ID,
      external_user_id: externalUserId,
    });
  } catch (err) {
    logger.warn('OneSignal setExternalUserId failed', { playerId, error: String(err) });
  }
}

export async function sendPushToUser(externalUserId: string, payload: OneSignalPayload): Promise<void> {
  if (!isOneSignalConfigured()) return;
  try {
    await callOneSignal('/notifications', {
      app_id: APP_ID,
      include_external_user_ids: [externalUserId],
      channel_for_external_user_ids: 'push',
      headings: { en: payload.title },
      contents: { en: payload.body },
      url: payload.url,
      data: payload.data,
      priority: payload.priority === 'high' ? 10 : 5,
      ttl: payload.priority === 'high' ? 86400 : 3600,
    });
  } catch (err) {
    logger.warn('OneSignal sendPushToUser failed', { externalUserId, error: String(err) });
  }
}

export async function sendPushToUsers(externalUserIds: string[], payload: OneSignalPayload): Promise<void> {
  if (!isOneSignalConfigured() || externalUserIds.length === 0) return;
  // OneSignal allows max 2000 external user IDs per request
  const CHUNK = 2000;
  for (let i = 0; i < externalUserIds.length; i += CHUNK) {
    const chunk = externalUserIds.slice(i, i + CHUNK);
    try {
      await callOneSignal('/notifications', {
        app_id: APP_ID,
        include_external_user_ids: chunk,
        channel_for_external_user_ids: 'push',
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
}
