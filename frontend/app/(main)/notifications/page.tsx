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

const FILTERS = [
  { key: 'all', label: 'Tutte' },
  { key: 'unread', label: 'Non lette' },
  { key: 'networking', label: 'Network' },
  { key: 'social', label: 'Social' },
  { key: 'opportunities', label: 'Opportunit\u00E0' },
  { key: 'universities', label: 'Universit\u00E0' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const router = useRouter();
  const { refresh } = useNotifications();

  const fetchNotifications = (filter: string) => {
    setLoading(true);
    api.get(`/notifications${filter !== 'all' ? `?filter=${filter}` : ''}`)
      .then(({ data }) => setNotifications(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications(activeFilter);
  }, [activeFilter]);

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

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const todayNotifs = notifications.filter((n) => new Date(n.createdAt).toDateString() === today);
  const yesterdayNotifs = notifications.filter((n) => new Date(n.createdAt).toDateString() === yesterday);
  const olderNotifs = notifications.filter((n) => {
    const d = new Date(n.createdAt).toDateString();
    return d !== today && d !== yesterday;
  });

  const renderSection = (title: string, items: Notification[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-text-muted mb-2">{title}</h3>
        <div className="space-y-2">
          {items.map((notif) => (
            <button
              key={notif.id}
              onClick={() => markAsRead(notif)}
              className={`card w-full text-left flex items-center gap-3 transition-colors ${
                !notif.isRead ? 'border-primary/30' : ''
              } hover:bg-card-hover`}
            >
              <span className="text-xl">{notif.icon || TYPE_ICONS[notif.type] || '\u{1F514}'}</span>
              <div className="flex-1">
                <p className={`text-sm ${!notif.isRead ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                  {notif.content}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {new Date(notif.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!notif.isRead && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3 animate-pulse">
        <h2 className="text-2xl font-display font-bold">Notifiche</h2>
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
        <h2 className="text-2xl font-display font-bold">Notifiche</h2>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Segna tutte come lette
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.key
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-surface/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-3xl mb-2">{'\u{1F514}'}</p>
          <p>Nessuna notifica</p>
        </div>
      ) : (
        <>
          {renderSection('Oggi', todayNotifs)}
          {renderSection('Ieri', yesterdayNotifs)}
          {renderSection('Precedenti', olderNotifs)}
        </>
      )}
    </div>
  );
}
