import api from '@/lib/api';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';

export interface PushDiagnostic {
  ts: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  detail?: any;
}

const diagnosticLog: PushDiagnostic[] = [];
const MAX_LOG = 50;

function log(level: PushDiagnostic['level'], step: string, detail?: any) {
  const entry: PushDiagnostic = { ts: new Date().toISOString(), level, step, detail };
  diagnosticLog.push(entry);
  if (diagnosticLog.length > MAX_LOG) diagnosticLog.shift();
  // Console for desktop devtools
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn('[OneSignal]', step, detail ?? '');
  // Fire-and-forget remote log so we can debug from mobile
  if (level !== 'info') {
    api.post('/notifications/push/diagnostic-log', { level, step, detail: serializeDetail(detail) }).catch(() => {});
  }
}

function serializeDetail(detail: any): any {
  if (!detail) return undefined;
  if (detail instanceof Error) return { name: detail.name, message: detail.message, stack: detail.stack };
  try {
    JSON.stringify(detail);
    return detail;
  } catch {
    return String(detail);
  }
}

export function getDiagnosticLog(): PushDiagnostic[] {
  return [...diagnosticLog];
}

export function isOneSignalAvailable(): boolean {
  return Boolean(APP_ID) && typeof window !== 'undefined';
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void>;
    OneSignal?: any;
  }
}

let initPromise: Promise<void> | null = null;
let registeredPlayerId: string | null = null;

export async function initOneSignal(): Promise<void> {
  if (!isOneSignalAvailable()) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        // Attach change listener BEFORE init so we never miss the first subscription event.
        try {
          OneSignal.User?.PushSubscription?.addEventListener?.('change', (event: any) => {
            const id = event?.current?.id;
            const optedIn = event?.current?.optedIn;
            log('info', 'subscription.change', { id, optedIn });
            if (id) void registerPlayerIdWithBackend(id);
          });
        } catch (e) {
          log('warn', 'attach.change.listener.failed', e);
        }

        await OneSignal.init({
          appId: APP_ID,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        log('info', 'init.complete', {
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          appId: APP_ID,
        });

        // If permission already granted in a previous session, ensure we register the existing id.
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const id = await waitForSubscriptionId(OneSignal, 5000);
          if (id) {
            await registerPlayerIdWithBackend(id);
          } else {
            log('warn', 'subscription.id.not.ready.after.timeout');
          }
        }
        resolve();
      } catch (err) {
        log('error', 'init.failed', err);
        resolve();
      }
    });
  });

  return initPromise;
}

/**
 * Polls OneSignal.User.PushSubscription.id with exponential backoff up to maxMs.
 * Returns the id as soon as it appears, or null on timeout.
 */
async function waitForSubscriptionId(OneSignal: any, maxMs: number): Promise<string | null> {
  const start = Date.now();
  let delay = 200;
  while (Date.now() - start < maxMs) {
    const id = OneSignal.User?.PushSubscription?.id;
    if (id) return id;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 1600);
  }
  return null;
}

async function registerPlayerIdWithBackend(playerId: string): Promise<void> {
  if (registeredPlayerId === playerId) return;
  try {
    await api.post('/notifications/push/onesignal-register', { playerId });
    registeredPlayerId = playerId;
    log('info', 'register.backend.ok', { playerId });
  } catch (err) {
    log('error', 'register.backend.failed', err);
  }
}

/**
 * Triggered by user gesture (button click). Requests permission, opts in explicitly,
 * waits for subscription id, registers with backend.
 */
export async function requestOneSignalPermission(): Promise<boolean> {
  if (!isOneSignalAvailable()) {
    log('warn', 'permission.skip.not.available');
    return false;
  }
  await initOneSignal();

  return new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.Notifications.requestPermission();
        const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        log('info', 'permission.result', { granted });
        if (!granted) {
          resolve(false);
          return;
        }
        try {
          if (OneSignal.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
            log('info', 'optIn.called');
          }
        } catch (e) {
          log('warn', 'optIn.failed', e);
        }
        const id = await waitForSubscriptionId(OneSignal, 5000);
        if (id) {
          await registerPlayerIdWithBackend(id);
          resolve(true);
        } else {
          log('error', 'subscription.id.unavailable.after.permission');
          resolve(false);
        }
      } catch (err) {
        log('error', 'permission.flow.failed', err);
        resolve(false);
      }
    });
  });
}

/**
 * Returns a live snapshot of subscription state for the diagnostic page.
 */
export async function getOneSignalSnapshot(): Promise<{
  available: boolean;
  permission: string;
  subscriptionId: string | null;
  optedIn: boolean | null;
}> {
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  if (!isOneSignalAvailable()) {
    return { available: false, permission, subscriptionId: null, optedIn: null };
  }
  await initOneSignal();
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal: any) => {
      const sub = OneSignal.User?.PushSubscription;
      resolve({
        available: true,
        permission,
        subscriptionId: sub?.id ?? null,
        optedIn: sub?.optedIn ?? null,
      });
    });
  });
}

/**
 * Unsubscribe current device (used by the "Reset" button on the diagnostic page).
 */
export async function optOutOneSignal(): Promise<void> {
  if (!isOneSignalAvailable()) return;
  await initOneSignal();
  return new Promise<void>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        if (OneSignal.User?.PushSubscription?.optOut) {
          await OneSignal.User.PushSubscription.optOut();
          log('info', 'optOut.called');
        }
        registeredPlayerId = null;
      } catch (e) {
        log('warn', 'optOut.failed', e);
      }
      resolve();
    });
  });
}
