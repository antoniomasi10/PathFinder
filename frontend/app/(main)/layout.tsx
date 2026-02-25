'use client';

import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { ToastProvider } from '@/components/Toast';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/home';

  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
        {isHome && <TopBar />}
        <main className="pb-20 max-w-lg mx-auto">{children}</main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
