import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const API_KEY = process.env.BREVO_API_KEY || '';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@cohaapp.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'COhA';

const EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const PUSH_URL = 'https://api.brevo.com/v3/webpush/notifications';

export function isBrevoConfigured(): boolean {
  return Boolean(API_KEY);
}

function brevoHeaders() {
  return {
    'Content-Type': 'application/json',
    'api-key': API_KEY,
  };
}

async function callBrevoEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch(EMAIL_URL, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Brevo email API error ${response.status}: ${text}`);
  }
}

async function callBrevoPush(subscriberId: string, title: string, body: string, url?: string): Promise<void> {
  const response = await fetch(PUSH_URL, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      title,
      message: body,
      url: url || '/',
      recipients: { ids: [subscriberId] },
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Brevo push API error ${response.status}: ${text}`);
  }
}

export interface BrevoPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
}

export async function sendEmailToUser(userId: string, subject: string, html: string): Promise<void> {
  if (!isBrevoConfigured()) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    await callBrevoEmail(user.email, subject, html);
  } catch (err) {
    logger.warn('Brevo sendEmailToUser failed', { userId, error: String(err) });
  }
}

export async function sendEmailToUsers(userIds: string[], subject: string, html: string): Promise<void> {
  if (!isBrevoConfigured() || userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });

    const CHUNK = 50;
    for (let i = 0; i < users.length; i += CHUNK) {
      const chunk = users.slice(i, i + CHUNK);
      await Promise.allSettled(
        chunk.map(u => callBrevoEmail(u.email, subject, html).catch(err =>
          logger.warn('Brevo sendEmailToUsers item failed', { userId: u.id, error: String(err) })
        ))
      );
      if (i + CHUNK < users.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } catch (err) {
    logger.warn('Brevo sendEmailToUsers failed', { error: String(err) });
  }
}

export async function sendPushToUser(userId: string, payload: BrevoPayload): Promise<void> {
  if (!isBrevoConfigured()) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { brevoSubscriberId: true } });
    if (!user?.brevoSubscriberId) return;
    await callBrevoPush(user.brevoSubscriberId, payload.title, payload.body, payload.url);
  } catch (err) {
    logger.warn('Brevo sendPushToUser failed', { userId, error: String(err) });
  }
}

export async function sendPushToUsers(userIds: string[], payload: BrevoPayload): Promise<void> {
  if (!isBrevoConfigured() || userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, brevoSubscriberId: { not: null } },
      select: { id: true, brevoSubscriberId: true },
    });
    if (users.length === 0) return;

    const CHUNK = 100;
    for (let i = 0; i < users.length; i += CHUNK) {
      const chunk = users.slice(i, i + CHUNK);
      await Promise.allSettled(
        chunk.map(u => callBrevoPush(u.brevoSubscriberId!, payload.title, payload.body, payload.url).catch(err =>
          logger.warn('Brevo sendPushToUsers item failed', { userId: u.id, error: String(err) })
        ))
      );
      if (i + CHUNK < users.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } catch (err) {
    logger.warn('Brevo sendPushToUsers failed', { error: String(err) });
  }
}
