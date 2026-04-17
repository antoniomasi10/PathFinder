'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { useNotifications } from '@/lib/notificationContext';
import {
  UsersGroup, Handshake, Briefcase, Alarm, BookOpen, Star,
  Trophy, Heart, ChatDots, Reply, Gear, Bell,
} from '@/components/icons';

interface Notification {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  linkTo?: string;
  icon?: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  FRIEND_REQUEST: <UsersGroup size={22} color="#4A9EFF" />,
  FRIEND_ACCEPTED: <Handshake size={22} color="#22C55E" />,
  NEW_OPPORTUNITY: <Briefcase size={22} color="#F59E0B" />,
  OPPORTUNITY_DEADLINE: <Alarm size={22} color="#EF4444" />,
  COURSE_DEADLINE: <BookOpen size={22} color="#EF4444" />,
  COURSE_RECOMMENDED: <Star size={22} color="#F59E0B" filled />,
  BADGE_UNLOCKED: <Trophy size={22} color="#FFD700" />,
  POST_LIKE: <Heart size={22} color="#EF4444" filled />,
  POST_COMMENT: <ChatDots size={22} color="#4A9EFF" />,
  COMMENT_REPLY: <Reply size={22} color="#8B8FA8" />,
  GROUP_UPDATE: <UsersGroup size={22} color="#4A9EFF" />,
  SYSTEM: <Gear size={22} color="#8B8FA8" />,
  GENERAL: <Bell size={22} color="#8B8FA8" />,
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const time = new Date(dateStr).getTime();
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ora';
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`;

  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  });
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();
  const { refresh } = useNotifications();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery<{ notifications: Notification[]; totalPages: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?page=1&limit=20');
      const items = data.data || data;
      return { notifications: Array.isArray(items) ? items : [], totalPages: data.totalPages ?? 1 };
    },
  });

  const notifications = data?.notifications ?? [];
  const totalPages = data?.totalPages ?? 1;

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data: res } = await api.get(`/notifications?page=${nextPage}&limit=20`);
      const items = res.data || res;
      queryClient.setQueryData<{ notifications: Notification[]; totalPages: number }>(
        ['notifications'],
        (prev) => prev
          ? { ...prev, notifications: [...prev.notifications, ...(Array.isArray(items) ? items : [])] }
          : prev!
      );
      setPage(nextPage);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ notifications: Notification[]; totalPages: number }>(
        ['notifications'],
        (prev) => prev
          ? { ...prev, notifications: prev.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n) }
          : prev!
      );
      refresh();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.setQueryData<{ notifications: Notification[]; totalPages: number }>(
        ['notifications'],
        (prev) => prev
          ? { ...prev, notifications: prev.notifications.map((n) => ({ ...n, isRead: true })) }
          : prev!
      );
      refresh();
    },
  });

  const markAsRead = async (notif: Notification) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    if (notif.linkTo) router.push(notif.linkTo);
  };

  const markAllRead = () => markAllReadMutation.mutate();

  const hasUnread = notifications.some((n) => !n.isRead);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const todayNotifs = notifications.filter((n) => new Date(n.createdAt).getTime() >= startOfToday);
  const yesterdayNotifs = notifications.filter((n) => {
    const ts = new Date(n.createdAt).getTime();
    return ts >= startOfYesterday && ts < startOfToday;
  });
  const olderNotifs = notifications.filter((n) => new Date(n.createdAt).getTime() < startOfYesterday);

  function renderSection(label: string, items: Notification[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-2">
          {items.map((notif) => (
            <button
              key={notif.id}
              onClick={() => markAsRead(notif)}
              className={`w-full text-left card flex items-start gap-3 transition-opacity active:opacity-75 ${notif.isRead ? 'opacity-60' : ''}`}
            >
              <span className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(74,158,255,0.1)' }}>
                {TYPE_ICONS[notif.type] || TYPE_ICONS.GENERAL}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${notif.isRead ? 'text-text-muted' : 'text-white font-medium'}`}>
                  {notif.content}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{formatTimeAgo(notif.createdAt)}</p>
              </div>
              {!notif.isRead && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3 animate-pulse">
        <h2 className="text-2xl font-display font-bold">{t.notifications.title}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-border rounded-full" />
            <div className="flex-1"><div className="h-4 bg-border rounded w-3/4" /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display font-bold">{t.notifications.title}</h2>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-xs text-primary font-medium hover:underline"
          >
            {t.notifications.markAllRead}
          </button>
        )}
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <div className="flex justify-center mb-2"><Bell size={32} color="#8B8FA8" /></div>
          <p>{t.notifications.empty}</p>
        </div>
      ) : (
        <>
          {renderSection(t.notifications.today, todayNotifs)}
          {renderSection(t.notifications.yesterday, yesterdayNotifs)}
          {renderSection(t.notifications.earlier, olderNotifs)}
          {page < totalPages && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-primary font-medium hover:underline disabled:opacity-50"
            >
              {loadingMore ? '...' : t.notifications.loadMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}
