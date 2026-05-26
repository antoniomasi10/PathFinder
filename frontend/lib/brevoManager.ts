import api from '@/lib/api';

const APP_ID = process.env.NEXT_PUBLIC_BREVO_APP_ID || '';

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
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn('[Brevo]', step, detail ?? '');
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

export function isBrevoAvailable(): boolean {
  return Boolean(APP_ID) && typeof window !== 'undefined';
}

declare global {
  interface Window {
    BrevoNotifications?: any;
    _brevoNotificationsLoaded?: boolean;
  }
}

let initPromise: Promise<void> | null = null;
let registeredSubscriberId: string | null = null;

function getBrevoSDK(): any | null {
  return typeof window !== 'undefined' ? window.BrevoNotifications ?? null : null;
}

export async function initBrevo(): Promise<void> {
  if (!isBrevoAvailable()) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve) => {
    const waitForSDK = () => {
      const sdk = getBrevoSDK();
      if (!sdk) {
        setTimeout(waitForSDK, 200);
        return;
      }
      try {
        sdk.init({ appId: APP_ID });
        log('info', 'init.complete', {
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          appId: APP_ID,
        });

        // If permission already granted, retrieve existing subscriberId and register
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const id = sdk.getSubscriberId?.();
          if (id) {
            void registerSubscriberIdWithBackend(id);
          }
        }
      } catch (err) {
        log('error', 'init.failed', err);
      }
      resolve();
    };
    waitForSDK();
  });

  return initPromise;
}

async function registerSubscriberIdWithBackend(subscriberId: string): Promise<void> {
  if (registeredSubscriberId === subscriberId) return;
  try {
    await api.post('/notifications/push/brevo-register', { subscriberId });
    registeredSubscriberId = subscriberId;
    log('info', 'register.backend.ok', { subscriberId });
  } catch (err) {
    log('error', 'register.backend.failed', err);
  }
}

export async function requestBrevoPermission(): Promise<boolean> {
  if (!isBrevoAvailable()) {
    log('warn', 'permission.skip.not.available');
    return false;
  }
  await initBrevo();

  try {
    const sdk = getBrevoSDK();
    if (!sdk) {
      log('warn', 'permission.skip.sdk.not.ready');
      return false;
    }

    await sdk.requestPermission?.();
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    log('info', 'permission.result', { granted });

    if (!granted) return false;

    const id = sdk.getSubscriberId?.();
    if (id) {
      await registerSubscriberIdWithBackend(id);
      return true;
    }

    // Wait up to 10s for subscriberId to be available after permission grant
    const maxMs = 10000;
    const start = Date.now();
    let delay = 200;
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 1600);
      const retryId = sdk.getSubscriberId?.();
      if (retryId) {
        await registerSubscriberIdWithBackend(retryId);
        return true;
      }
    }

    log('error', 'subscriber.id.unavailable.after.permission');
    return false;
  } catch (err) {
    log('error', 'permission.flow.failed', err);
    return false;
  }
}

export async function getBrevoSnapshot(): Promise<{
  available: boolean;
  permission: string;
  subscriberId: string | null;
  optedIn: boolean | null;
}> {
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  if (!isBrevoAvailable()) {
    return { available: false, permission, subscriberId: null, optedIn: null };
  }
  await initBrevo();
  const sdk = getBrevoSDK();
  const subscriberId = sdk?.getSubscriberId?.() ?? null;
  return {
    available: true,
    permission,
    subscriberId,
    optedIn: permission === 'granted' && Boolean(subscriberId),
  };
}

export async function optOutBrevo(): Promise<void> {
  if (!isBrevoAvailable()) return;
  await initBrevo();
  try {
    const sdk = getBrevoSDK();
    await sdk?.unsubscribe?.();
    registeredSubscriberId = null;
    log('info', 'optOut.called');
  } catch (e) {
    log('warn', 'optOut.failed', e);
  }
}
