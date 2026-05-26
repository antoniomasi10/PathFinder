import api from '@/lib/api';
import {
  isBrevoAvailable,
  initBrevo,
  requestBrevoPermission,
  optOutBrevo,
} from '@/lib/brevoManager';

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

export async function ensurePushInitialized(): Promise<void> {
  if (!isPushSupported() || !isBrevoAvailable()) return;
  await initBrevo();
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported() || !isBrevoAvailable()) return false;
  return requestBrevoPermission();
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported() || !isBrevoAvailable()) return false;
  try {
    await optOutBrevo();
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
