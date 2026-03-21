import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    // Wait for the SW to be ready
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-sync subscription with backend (may have changed)
      const json = existing.toJSON();
      await api.post('/notifications/push/subscribe', {
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        },
      });
      return true;
    }

    // Fetch VAPID key from backend
    const { data } = await fetch(`${API_URL}/api/notifications/push/vapid-key`).then((r) =>
      r.json().then((d) => ({ data: d }))
    );
    if (!data.publicKey) return false;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
    });

    // Send subscription to backend
    const json = subscription.toJSON();
    await api.post('/notifications/push/subscribe', {
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      },
    });

    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.delete('/notifications/push/unsubscribe', { data: { endpoint } });
    }
    return true;
  } catch {
    return false;
  }
}

export async function sendTestPush(): Promise<boolean> {
  try {
    const { data } = await api.post('/notifications/push/test');
    return data.success;
  } catch {
    return false;
  }
}
