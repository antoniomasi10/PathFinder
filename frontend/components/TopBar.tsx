'use client';

import Link from 'next/link';
import { useNotifications } from '@/lib/notificationContext';
import { Bell } from '@/components/icons';

export default function TopBar() {
  const { unreadCount } = useNotifications();

  return (
    <header className="sticky top-0 bg-surface/80 backdrop-blur-lg border-b border-border/50 z-40">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3 relative">
        <h1 className="absolute inset-0 flex items-center justify-center text-lg font-display font-bold text-white pointer-events-none">
          Pathfinder
        </h1>
        <Link href="/notifications" className="relative p-2 ml-auto z-10" aria-label="Notifiche">
          <Bell size={24} strokeWidth={2} className="text-text-secondary" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
