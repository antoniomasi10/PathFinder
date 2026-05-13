import api from '@/lib/api';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';

export function isOneSignalAvailable(): boolean {
  return Boolean(APP_ID) && typeof window !== 'undefined';
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void>;
    OneSignal?: any;
  }
}

let initCalled = false;

export async function initOneSignal(): Promise<void> {
  if (!isOneSignalAvailable() || initCalled) return;
  initCalled = true;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/sw.js',
        notifyButton: { enable: false },
      });

      // Listen for subscription changes — fires when SDK creates/updates subscription
      OneSignal.User?.PushSubscription?.addEventListener('change', async (event: any) => {
        const id = event?.current?.id;
        if (id) await registerPlayerIdWithBackend(id);
      });

      // If permission already granted, trigger subscription creation and register
      if (Notification.permission === 'granted') {
        try {
          // requestPermission is a no-op if already granted, but triggers subscription creation
          await OneSignal.Notifications.requestPermission();
        } catch {}
        // Wait for SDK to finalize the push subscription
        await new Promise(r => setTimeout(r, 1500));
        const id = OneSignal.User?.PushSubscription?.id;
        if (id) await registerPlayerIdWithBackend(id);
      }
    } catch {
      // Non-critical — VAPID fallback still active
    }
  });
}

async function registerPlayerIdWithBackend(playerId: string): Promise<void> {
  try {
    await api.post('/notifications/push/onesignal-register', { playerId });
  } catch {
    // silently ignore
  }
}

export async function requestOneSignalPermission(): Promise<boolean> {
  if (!isOneSignalAvailable()) return false;
  try {
    return new Promise((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.Notifications.requestPermission();
          const granted = Notification.permission === 'granted';
          if (granted) {
            const sub = OneSignal.User?.PushSubscription;
            const id = sub?.id;
            if (id) await registerPlayerIdWithBackend(id);
          }
          resolve(granted);
        } catch {
          resolve(false);
        }
      });
    });
  } catch {
    return false;
  }
}
