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

  // Order per Figma: Home | Uni | Chat | Profile
  const navItems = [
    {
      href: '/home',
      label: t.nav.home,
      icon: (active: boolean) => (
        <House size={24} filled={active} strokeWidth={active ? 2 : 1.5} />
      ),
    },
    {
      href: '/universities',
      label: t.nav.uni,
      icon: (active: boolean) => (
        <GraduationCap size={24} strokeWidth={active ? 2 : 1.5} />
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
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: 'white',
        borderTop: '1px solid #ecedff',
        boxShadow: '0px -4px 6px rgba(0,0,0,0.05)',
        height: 64,
      }}
    >
      <div
        className="max-w-lg mx-auto flex items-start pb-safe"
        style={{ paddingLeft: 28.73, paddingRight: 28.75, paddingTop: 9, gap: 35 }}
      >
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const badge = badgeMap[item.href] || 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="flex-1 flex flex-col items-center"
            >
              <span className="relative">
                {isActive ? (
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 43,
                      height: 43,
                      backgroundColor: '#615fe2',
                      color: 'white',
                    }}
                  >
                    {item.icon(true)}
                  </span>
                ) : (
                  <span
                    className="flex items-center justify-center"
                    style={{ width: 43, height: 43, color: '#acb0ce' }}
                  >
                    {item.icon(false)}
                  </span>
                )}
                {badge > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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
