'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/language';
import { useNotifications } from '@/lib/notificationContext';
import { GraduationCap, House, Chat, UserIcon } from '@/components/icons';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { badgeCounts } = useNotifications();

  const navItems = [
    {
      href: '/universities',
      label: t.nav.uni,
      icon: (active: boolean) => (
        <GraduationCap size={24} strokeWidth={active ? 2 : 1.5} />
      ),
    },
    {
      href: '/home',
      label: t.nav.home,
      icon: (active: boolean) => (
        <House size={24} filled={active} strokeWidth={active ? 2 : 1.5} />
      ),
    },
    {
      href: '/networking',
      label: t.nav.network,
      icon: (active: boolean) => (
        <Chat size={24} strokeWidth={active ? 2 : 1.5} />
      ),
    },
    {
      href: '/profile',
      label: t.nav.profile,
      icon: (active: boolean) => (
        <UserIcon size={24} filled={active} strokeWidth={active ? 2 : 1.5} />
      ),
    },
  ];

  const badgeMap: Record<string, number> = {
    '/home': badgeCounts.opportunities,
    '/networking': badgeCounts.networking,
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#1a1b2e] border-t border-indigo-900/20 z-50"
      style={{ boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)' }}
    >
      <div className="max-w-lg mx-auto flex">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const badge = badgeMap[item.href] || 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex-1 flex flex-col items-center py-3 transition-colors relative ${
                isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              {/* Active top bar indicator */}
              {isActive && (
                <div
                  className="absolute top-0 w-12 h-1 bg-indigo-500 rounded-b-full"
                  style={{ boxShadow: '0 2px 15px rgba(99,102,241,0.6)' }}
                />
              )}

              {/* Active glow background */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 50% 30%, rgba(99,102,241,0.2) 0%, transparent 70%)',
                  }}
                />
              )}

              <span className="relative z-10">
                {item.icon(isActive)}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
