'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function TopBar() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 bg-surface/80 backdrop-blur-lg border-b border-border/50 z-40">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3 relative">
        <h1 className="absolute inset-0 flex items-center justify-center text-lg font-display font-bold text-white pointer-events-none">
          Pathfinder
        </h1>
        <Link href="/notifications" className="relative p-2 ml-auto z-10">
          <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
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
