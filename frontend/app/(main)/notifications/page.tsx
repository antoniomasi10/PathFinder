'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { useNotifications } from '@/lib/notificationContext';

interface Notification {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  linkTo?: string;
  icon?: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  FRIEND_REQUEST: '\u{1F465}',
  FRIEND_ACCEPTED: '\u{1F91D}',
  NEW_OPPORTUNITY: '\u{1F4BC}',
  OPPORTUNITY_DEADLINE: '\u{23F0}',
  COURSE_DEADLINE: '\u{1F4DA}',
  COURSE_RECOMMENDED: '\u{2B50}',
  BADGE_UNLOCKED: '\u{1F3C6}',
  POST_LIKE: '\u{2764}\u{FE0F}',
  POST_COMMENT: '\u{1F4AC}',
  COMMENT_REPLY: '\u{21A9}\u{FE0F}',
  GROUP_UPDATE: '\u{1F465}',
  SYSTEM: '\u{2699}\u{FE0F}',
  GENERAL: '\u{1F514}',
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();
  const { refresh } = useNotifications();

  useEffect(() => {
    api.get('/notifications?page=1&limit=20')
      .then(({ data }) => {
        const items = data.data || data;
        setNotifications(Array.isArray(items) ? items : []);
        if (data.totalPages) setTotalPages(data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await api.get(`/notifications?page=${nextPage}&limit=20`);
      const items = data.data || data;
      setNotifications((prev) => [...prev, ...(Array.isArray(items) ? items : [])]);
      setPage(nextPage);
      if (data.totalPages) setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const markAsRead = async (notif: Notification) => {
    if (!notif.isRead) {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, isRead: true } : n));
      refresh();
    }
    if (notif.linkTo) {
      router.push(notif.linkTo);
    }
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    refresh();
  };

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
              <span className="text-2xl flex-shrink-0 mt-0.5">
                {notif.icon || TYPE_ICONS[notif.type] || TYPE_ICONS.GENERAL}
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
          <p className="text-3xl mb-2">🔔</p>
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
