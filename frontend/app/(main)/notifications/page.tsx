'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
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
  const router = useRouter();
  const { refresh } = useNotifications();

  useEffect(() => {
    api.get('/notifications')
      .then(({ data }) => setNotifications(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3 animate-pulse">
        <h2 className="text-2xl font-display font-bold">Notifiche</h2>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card">
            <div className="w-8 h-8 bg-border rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-border rounded w-3/4" />
              <div className="h-3 bg-border rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-display font-bold">Notifiche</h2>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-xs text-primary font-medium hover:text-primary/80 transition-colors"
          >
            Segna tutte come lette
          </button>
        )}
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4 opacity-40">{'\u{1F514}'}</span>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Nessuna notifica</h3>
          <p className="text-sm text-text-muted max-w-[280px] leading-relaxed">
            Quando riceverai notifiche, appariranno qui
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => markAsRead(notif)}
              className={`w-full text-left flex items-start gap-3 p-4 rounded-xl relative transition-colors ${
                !notif.isRead
                  ? 'bg-[#1E2538] hover:bg-[#242B3D]'
                  : 'bg-card hover:bg-card-hover'
              }`}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">
                {notif.icon || TYPE_ICONS[notif.type] || '\u{1F514}'}
              </span>
              <div className="flex-1 min-w-0 pr-4">
                <p
                  className={`text-sm leading-snug line-clamp-2 ${
                    !notif.isRead ? 'text-text-primary font-medium' : 'text-text-secondary'
                  }`}
                >
                  {notif.content}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {formatTimeAgo(notif.createdAt)}
                </p>
              </div>
              {!notif.isRead && (
                <span className="absolute top-5 right-4 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
