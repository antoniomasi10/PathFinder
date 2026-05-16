/**
 * Server-side analytics: Sentry (errors) + PostHog (product events).
 *
 * Both are optional — if their env vars are missing, the wrappers no-op silently.
 * Call initAnalytics() once at boot before mounting routes.
 */

import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { logger } from '../utils/logger';

let posthog: PostHog | null = null;
let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    });
    logger.info('[Analytics] Sentry initialized');
  }

  if (process.env.POSTHOG_API_KEY) {
    posthog = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 20,
      flushInterval: 10_000,
    });
    logger.info('[Analytics] PostHog initialized');
  }
}

export function captureServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthog) return;
  try {
    posthog.capture({ distinctId: userId, event, properties });
  } catch (err) {
    logger.debug(`[Analytics] capture failed: ${err}`);
  }
}

export async function shutdownAnalytics(): Promise<void> {
  if (posthog) await posthog.shutdown().catch(() => {});
  await Sentry.flush(2000).catch(() => {});
}

export { Sentry };
