'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();

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
      <h2 className="text-2xl font-display font-bold mb-4">Notifiche</h2>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-3xl mb-2">🔔</p>
          <p>Nessuna notifica</p>
        </div>
      ) : (
        <>
          {renderSection('Oggi', todayNotifs)}
          {renderSection('Ieri', yesterdayNotifs)}
          {renderSection('Precedenti', olderNotifs)}
          {page < totalPages && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
            >
              {loadingMore ? 'Caricamento...' : 'Carica altro'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
