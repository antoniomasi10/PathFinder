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
  data?: Record<string, any>;
}

function resolveNavTarget(notif: Notification): string | null {
  const { type, data, linkTo } = notif;
  if (type === 'NEW_OPPORTUNITY') {
    const id = data?.opportunityId;
    if (id) return `/opportunities/${id}`;
  }
  if (type === 'OPPORTUNITY_DEADLINE') {
    return '/profile/saved-opportunities';
  }
  if (type === 'POST_LIKE' || type === 'POST_COMMENT' || type === 'COMMENT_REPLY') {
    const id = data?.postId;
    if (id) return `/networking?post=${id}`;
  }
  return linkTo ?? null;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  FRIEND_REQUEST:       { icon: <UsersGroup size={22} color="#4A9EFF" />,   bg: 'rgba(74,158,255,0.12)' },
  FRIEND_ACCEPTED:      { icon: <Handshake size={22} color="#22C55E" />,    bg: 'rgba(34,197,94,0.12)' },
  NEW_OPPORTUNITY:      { icon: <Briefcase size={22} color="#615FE2" />,    bg: 'rgba(97,95,226,0.1)' },
  OPPORTUNITY_DEADLINE: { icon: <Alarm size={22} color="#EF4444" />,        bg: 'rgba(255,218,214,0.5)' },
  COURSE_DEADLINE:      { icon: <BookOpen size={22} color="#EF4444" />,     bg: 'rgba(255,218,214,0.5)' },
  COURSE_RECOMMENDED:   { icon: <Star size={22} color="#F59E0B" filled />,  bg: 'rgba(245,158,11,0.12)' },
  BADGE_UNLOCKED:       { icon: <Trophy size={22} color="#FFD700" />,       bg: 'rgba(255,215,0,0.15)' },
  POST_LIKE:            { icon: <Heart size={22} color="#EF4444" filled />, bg: 'rgba(239,68,68,0.1)' },
  POST_COMMENT:         { icon: <ChatDots size={22} color="#8646F7" />,     bg: 'rgba(134,70,247,0.1)' },
  COMMENT_REPLY:        { icon: <Reply size={22} color="#8B8FA8" />,        bg: 'rgba(139,143,168,0.12)' },
  GROUP_UPDATE:         { icon: <UsersGroup size={22} color="#4A9EFF" />,   bg: 'rgba(74,158,255,0.12)' },
  SYSTEM:               { icon: <Gear size={22} color="#8B8FA8" />,         bg: '#e6e7f8' },
  GENERAL:              { icon: <Bell size={22} color="#8B8FA8" />,         bg: '#e6e7f8' },
};

function formatTimestamp(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const ts = date.getTime();

  if (ts >= startOfToday) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  if (ts >= startOfYesterday) return 'Ieri';
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function NotificationItem({ notif, onPress, onDelete }: { notif: Notification; onPress: () => void; onDelete: () => void }) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.GENERAL;
  return (
    <div className={`w-full flex gap-2 items-center bg-white border border-[rgba(199,196,214,0.3)] rounded-[24px] px-[17px] py-[13px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] ${notif.isRead ? 'opacity-75' : ''}`}>
      {/* Clickable main area */}
      <button
        onClick={onPress}
        className="flex-1 min-w-0 text-left flex gap-4 items-center active:opacity-70 transition-opacity"
      >
        {/* Icon box */}
        <div
          className="shrink-0 w-12 h-12 rounded-[12px] flex items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          {cfg.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[14px] text-[#191b27] leading-[20px] line-clamp-1">
              {notif.content.split('\n')[0]}
            </span>
            <span className="shrink-0 font-['Plus_Jakarta_Sans',sans-serif] font-medium text-[12px] text-[#777585] tracking-[0.5px] leading-[16px] mt-[2px]">
              {formatTimestamp(notif.createdAt)}
            </span>
          </div>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] text-[#464554] leading-[20px] line-clamp-2">
            {notif.content}
          </p>
        </div>

        {/* Unread dot */}
        <div className="shrink-0 w-2 self-stretch flex flex-col items-center justify-start pt-1">
          {!notif.isRead && (
            <span className="w-2 h-2 rounded-full bg-[#4844c8]" />
          )}
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="shrink-0 p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
        title="Elimina notifica"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

function Section({ label, items, onPress, onDelete }: { label: string; items: Notification[]; onPress: (n: Notification) => void; onDelete: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="px-2">
        <p className="font-['Plus_Jakarta_Sans',sans-serif] font-medium text-[12px] text-[#464554] tracking-[0.6px] uppercase leading-[16px]">
          {label}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((n) => (
          <NotificationItem key={n.id} notif={n} onPress={() => onPress(n)} onDelete={() => onDelete(n.id)} />
        ))}
      </div>
    </div>
  );
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

  const deleteNotifMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ notifications: Notification[]; totalPages: number }>(
        ['notifications'],
        (prev) => prev
          ? { ...prev, notifications: prev.notifications.filter((n) => n.id !== id) }
          : prev!
      );
      refresh();
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess: () => {
      queryClient.setQueryData<{ notifications: Notification[]; totalPages: number }>(
        ['notifications'],
        (prev) => prev ? { ...prev, notifications: [] } : prev!
      );
      refresh();
    },
  });

  const handleNotifPress = (notif: Notification) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    const target = resolveNavTarget(notif);
    if (target) router.push(target);
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const todayNotifs     = notifications.filter((n) => new Date(n.createdAt).getTime() >= startOfToday);
  const yesterdayNotifs = notifications.filter((n) => {
    const ts = new Date(n.createdAt).getTime();
    return ts >= startOfYesterday && ts < startOfToday;
  });
  const olderNotifs = notifications.filter((n) => new Date(n.createdAt).getTime() < startOfYesterday);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f3f2ff' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-center h-16 px-4 relative"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(172,176,206,0.2)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          aria-label="Indietro"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 13L5 8L10 3" stroke="#2C3149" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <svg width="129" height="37" viewBox="0 0 129 37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="COhA">
          <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
          <path d="M69.5115 18.9309C69.2759 19.1653 69.0214 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
          <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
          <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
          <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0214 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
          <mask id="notif-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="35" y="0" width="63" height="37">
            <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C69.2759 19.1653 69.0215 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
            <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0215 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
          </mask>
          <g mask="url(#notif-mask)">
            <rect x="21.1184" y="8.70459" width="46.8622" height="28.2899" fill="url(#notif-g0)"/>
            <rect x="69.215" y="18.6378" width="49.7354" height="29.6082" fill="url(#notif-g1)"/>
            <rect x="64.48" y="23.0285" width="17.4359" height="37.5037" fill="url(#notif-g2)"/>
            <rect x="65.8629" y="-9.88831" width="25.4121" height="27.3988" fill="url(#notif-g3)" fillOpacity="0.75"/>
          </g>
          <path d="M38.29 30.9597C36.9907 30.9597 35.7808 30.7242 34.6601 30.2532C33.5558 29.7822 32.5894 29.1245 31.7612 28.28C30.9329 27.4354 30.2833 26.4448 29.8123 25.3079C29.3575 24.171 29.1302 22.9286 29.1302 21.5806C29.1302 20.2326 29.3575 18.9902 29.8123 17.8534C30.267 16.7003 30.9085 15.7096 31.7368 14.8813C32.5651 14.0368 33.5314 13.3872 34.6358 12.9324C35.7564 12.4614 36.9745 12.2259 38.29 12.2259C39.6055 12.2259 40.7829 12.4452 41.8223 12.8837C42.878 13.3222 43.7712 13.9069 44.5021 14.6377C45.2329 15.3685 45.7526 16.1806 46.0612 17.0738L42.7237 18.6817C42.4151 17.8046 41.8711 17.0819 41.0915 16.5135C40.3282 15.9288 39.3943 15.6365 38.29 15.6365C37.2181 15.6365 36.2761 15.8882 35.4641 16.3917C34.652 16.8952 34.0186 17.5935 33.5639 18.4868C33.1254 19.3638 32.9061 20.3951 32.9061 21.5806C32.9061 22.7662 33.1254 23.8056 33.5639 24.6989C34.0186 25.5921 34.652 26.2905 35.4641 26.7939C36.2761 27.2974 37.2181 27.5491 38.29 27.5491C39.3943 27.5491 40.3282 27.2649 41.0915 26.6965C41.8711 26.1118 42.4151 25.381 42.7237 24.504L46.0612 26.1118C45.7526 27.0051 45.2329 27.8171 44.5021 28.5479C43.7712 29.2788 42.878 29.8634 41.8223 30.3019C40.7829 30.7404 39.6055 30.9597 38.29 30.9597ZM56.9619 30.9597C55.5976 30.9597 54.3309 30.7242 53.1615 30.2532C51.9922 29.7822 50.969 29.1245 50.092 28.28C49.2312 27.4192 48.5573 26.4204 48.07 25.2835C47.5828 24.1467 47.3392 22.9124 47.3392 21.5806C47.3392 20.2489 47.5747 19.0146 48.0457 17.8777C48.5329 16.7409 49.2069 15.7502 50.0676 14.9057C50.9447 14.0611 51.9678 13.4034 53.1372 12.9324C54.3065 12.4614 55.5814 12.2259 56.9619 12.2259C58.3423 12.2259 59.6172 12.4614 60.7866 12.9324C61.9559 13.4034 62.971 14.0611 63.8317 14.9057C64.7087 15.7502 65.3827 16.7409 65.8537 17.8777C66.3409 19.0146 66.5845 20.2489 66.5845 21.5806C66.5845 22.9124 66.3409 24.1467 65.8537 25.2835C65.3665 26.4204 64.6844 27.4192 63.8074 28.28C62.9466 29.1245 61.9316 29.7822 60.7622 30.2532C59.5929 30.7242 58.3261 30.9597 56.9619 30.9597ZM56.9619 27.5491C57.7901 27.5491 58.5535 27.403 59.2518 27.1106C59.9664 26.8183 60.5917 26.4123 61.1276 25.8926C61.6636 25.3566 62.0777 24.7232 62.3701 23.9924C62.6624 23.2616 62.8086 22.4576 62.8086 21.5806C62.8086 20.7036 62.6624 19.9078 62.3701 19.1932C62.0777 18.4624 61.6636 17.829 61.1276 17.2931C60.5917 16.7571 59.9664 16.3511 59.2518 16.075C58.5535 15.7827 57.7901 15.6365 56.9619 15.6365C56.1336 15.6365 55.3621 15.7827 54.6476 16.075C53.9492 16.3511 53.332 16.7571 52.7961 17.2931C52.2602 17.829 51.846 18.4624 51.5537 19.1932C51.2613 19.9078 51.1152 20.7036 51.1152 21.5806C51.1152 22.4576 51.2613 23.2616 51.5537 23.9924C51.846 24.7232 52.2602 25.3566 52.7961 25.8926C53.332 26.4123 53.9492 26.8183 54.6476 27.1106C55.3621 27.403 56.1336 27.5491 56.9619 27.5491ZM82.3872 30.6674L88.5262 12.5183H93.5446L99.6836 30.6674H95.5666L94.3485 26.9645H87.6979L86.4798 30.6674H82.3872ZM88.7454 23.6757H93.301L90.5238 15.1006H91.547L88.7454 23.6757Z" fill="#2C3149"/>
          <defs>
            <linearGradient id="notif-g0" x1="90.8031" y1="24.4817" x2="17.1625" y2="24.4817" gradientUnits="userSpaceOnUse">
              <stop offset="0.240385" stopColor="#615FE2" stopOpacity="0.52"/>
              <stop offset="0.602697" stopColor="#FBF8FF"/>
            </linearGradient>
            <linearGradient id="notif-g1" x1="143.172" y1="35.1501" x2="65.0165" y2="35.1501" gradientUnits="userSpaceOnUse">
              <stop offset="0.649865" stopColor="#FBF8FF"/>
              <stop offset="0.941702" stopColor="#615FE2" stopOpacity="0.52"/>
            </linearGradient>
            <linearGradient id="notif-g2" x1="73.0335" y1="20.1116" x2="73.2974" y2="60.5316" gradientUnits="userSpaceOnUse">
              <stop stopColor="#615FE2" stopOpacity="0.46"/>
              <stop offset="0.447379" stopColor="#FBF8FF" stopOpacity="0.49"/>
            </linearGradient>
            <linearGradient id="notif-g3" x1="87.6447" y1="-10.9698" x2="66.1891" y2="12.2683" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FBF8FF"/>
              <stop offset="0.870192" stopColor="#615FE2"/>
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute right-4 flex flex-col items-end gap-0.5">
          {hasUnread && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="text-[11px] font-medium text-[#615FE2] hover:opacity-70 transition-opacity"
            >
              Segna tutto letto
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => deleteAllMutation.mutate()}
              className="text-[11px] font-medium text-red-400 hover:opacity-70 transition-opacity"
            >
              Elimina tutte
            </button>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 px-4 pt-4 pb-24 flex flex-col gap-6 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[78px] bg-white/60 rounded-[24px]" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-[16px] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
              <Bell size={28} color="#615FE2" />
            </div>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[14px] text-[#777585] text-center">
              {t.notifications.empty}
            </p>
          </div>
        ) : (
          <>
            <Section label={t.notifications.today}     items={todayNotifs}     onPress={handleNotifPress} onDelete={(id) => deleteNotifMutation.mutate(id)} />
            <Section label={t.notifications.yesterday} items={yesterdayNotifs} onPress={handleNotifPress} onDelete={(id) => deleteNotifMutation.mutate(id)} />
            <Section label={t.notifications.earlier}   items={olderNotifs}     onPress={handleNotifPress} onDelete={(id) => deleteNotifMutation.mutate(id)} />
            {page < totalPages && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 text-[13px] text-[#615FE2] font-medium disabled:opacity-50"
              >
                {loadingMore ? '…' : t.notifications.loadMore}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
