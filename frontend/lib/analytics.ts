'use client';

import posthog from 'posthog-js';

/**
 * Typed event names — keep this list as the single source of truth for product events.
 * Adding a new event? Add it here so dashboards and code stay aligned.
 */
export type EventName =
  | 'signup_completed'
  | 'login_succeeded'
  | 'onboarding_completed'
  | 'opportunity_of_day_viewed'
  | 'opportunity_viewed'
  | 'opportunity_saved'
  | 'opportunity_unsaved'
  | 'opportunity_clicked_apply'
  | 'post_created'
  | 'post_liked'
  | 'comment_added'
  | 'message_sent'
  | 'friend_request_sent'
  | 'friend_request_accepted';

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  });
  initialized = true;
}

export function track(event: EventName, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
