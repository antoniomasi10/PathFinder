'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';

interface Notification {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  linkTo?: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  NEW_MESSAGE: '💬',
  NEW_OPPORTUNITY: '💼',
  GENERAL: '🔔',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useLanguage();

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
    }
    if (notif.linkTo) {
      router.push(notif.linkTo);
    }
  };

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
              <span className="text-xl">{TYPE_ICONS[notif.type] || '🔔'}</span>
              <div className="flex-1">
                <p className={`text-sm ${!notif.isRead ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                  {notif.content}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {new Date(notif.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!notif.isRead && <span className="w-2 h-2 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    );
  };

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
      <h2 className="text-2xl font-display font-bold mb-4">{t.notifications.title}</h2>

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
        </>
      )}
    </div>
  );
}
