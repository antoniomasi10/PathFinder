'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import api, { getAccessToken } from '@/lib/api';
import { ensurePushInitialized, isPushSupported, checkPushReEnrollment } from '@/lib/pushManager';

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
  showReEnrollBanner: boolean;
  dismissReEnrollBanner: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  badgeCounts: { networking: 0, opportunities: 0, chat: 0 },
  refresh: () => {},
  showReEnrollBanner: false,
  dismissReEnrollBanner: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({ networking: 0, opportunities: 0, chat: 0 });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showReEnrollBanner, setShowReEnrollBanner] = useState(false);
  const queryClient = useQueryClient();

  const dismissReEnrollBanner = useCallback(() => {
    localStorage.setItem('pushReEnrollDismissedAt', Date.now().toString());
    setShowReEnrollBanner(false);
  }, []);

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

    // Initialize OneSignal SDK (registers its own SW, attaches subscription listener).
    // Idempotent and does NOT request permission — that requires a user gesture.
    if (typeof window !== 'undefined' && isPushSupported()) {
      ensurePushInitialized()
        .then(() => {
          // After init, check if user needs to re-enroll (e.g. after App ID change).
          // Delay slightly so init settles, then skip if dismissed within last 3 days.
          setTimeout(async () => {
            const dismissedAt = localStorage.getItem('pushReEnrollDismissedAt');
            if (dismissedAt && Date.now() - Number(dismissedAt) < 3 * 24 * 60 * 60 * 1000) return;
            const needs = await checkPushReEnrollment();
            if (needs) setShowReEnrollBanner(true);
          }, 3000);
        })
        .catch(() => {});
    }

    return () => {
      ns.disconnect();
    };
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, badgeCounts, refresh, showReEnrollBanner, dismissReEnrollBanner }}>
      {children}
    </NotificationContext.Provider>
  );
}
