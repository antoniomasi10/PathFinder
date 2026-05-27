import api from '@/lib/api';
import {
  isOneSignalAvailable,
  initOneSignal,
  requestOneSignalPermission,
  optOutOneSignal,
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
