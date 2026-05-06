'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import api, { getAccessToken } from '@/lib/api';
import { registerServiceWorker, subscribeToPush, isPushSupported } from '@/lib/pushManager';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BadgeCounts {
  networking: number;
  opportunities: number;
  chat: number;
}

interface NotificationContextType {
  unreadCount: number;
  badgeCounts: BadgeCounts;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  badgeCounts: { networking: 0, opportunities: 0, chat: 0 },
  refresh: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({ networking: 0, opportunities: 0, chat: 0 });
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count))
      .catch(() => {});
    api.get('/notifications/badge-counts')
      .then(({ data }) => setBadgeCounts(data))
      .catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  useEffect(() => {
    refresh();

    const token = getAccessToken();
    if (!token) return;

    const ns = io(`${API_URL}/notifications`, {
      auth: { token },
      transports: ['websocket'],
    });

    ns.on('new_notification', (data: { unreadCount: number }) => {
      setUnreadCount(data.unreadCount);
      api.get('/notifications/badge-counts')
        .then(({ data }) => setBadgeCounts(data))
        .catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    setSocket(ns);

    // Register service worker and re-sync push subscription
    if (typeof window !== 'undefined' && isPushSupported()) {
      registerServiceWorker().then(() => {
        // If user already granted permission, re-sync subscription with backend
        if (Notification.permission === 'granted') {
          subscribeToPush().catch(() => {});
        }
      });
    }

    return () => {
      ns.disconnect();
    };
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, badgeCounts, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}
