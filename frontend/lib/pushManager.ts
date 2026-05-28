import api from '@/lib/api';
import {
  isOneSignalAvailable,
  initOneSignal,
  requestOneSignalPermission,
  optOutOneSignal,
  getOneSignalSnapshot,
} from '@/lib/oneSignalManager';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Initializes OneSignal SDK. Idempotent — safe to call multiple times.
 * Does NOT request permission. The SDK registers its own service worker
 * (/OneSignalSDKWorker.js) on init.
 */
export async function ensurePushInitialized(): Promise<void> {
  if (!isPushSupported() || !isOneSignalAvailable()) return;
  await initOneSignal();
}

/**
 * MUST be called from a user gesture handler. Requests notification permission
 * and registers the device with OneSignal + the backend.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported() || !isOneSignalAvailable()) return false;
  return requestOneSignalPermission();
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported() || !isOneSignalAvailable()) return false;
  try {
    await optOutOneSignal();
    return true;
  } catch {
    return false;
  }
}

export async function sendTestPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data } = await api.post('/notifications/push/test');
    return { success: Boolean(data?.success), error: data?.error };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || err?.message || 'Unknown error' };
  }
}

/**
 * Returns true if the user has push permission but is not registered with
 * the current OneSignal App ID in the backend (e.g. after an App ID change).
 */
export async function checkPushReEnrollment(): Promise<boolean> {
  if (!isPushSupported() || !isOneSignalAvailable()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const { data } = await api.get('/notifications/push/status');
    if (!data.oneSignalPlayerId) return true;
    const snapshot = await getOneSignalSnapshot();
    if (snapshot.subscriptionId && snapshot.subscriptionId !== data.oneSignalPlayerId) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Unregisters stale OneSignal service workers then triggers a fresh subscription.
 * Must be called from a user gesture handler.
 */
export async function reEnrollPush(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => r.active?.scriptURL.includes('OneSignalSDK'))
          .map((r) => r.unregister()),
      );
    } catch {}
  }
  return subscribeToPush();
}
