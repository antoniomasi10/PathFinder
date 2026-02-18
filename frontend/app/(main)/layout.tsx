'use client';

import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideTopBar = pathname === '/home' || pathname === '/profile';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
      {!hideTopBar && <TopBar />}
      <main className="pb-20 max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
