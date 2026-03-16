'use client';

import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { SavedOpportunitiesProvider } from '@/lib/savedOpportunities';
import { SavedCoursesProvider } from '@/lib/savedCourses';
import { ToastProvider } from '@/components/Toast';
import BadgeProvider from '@/components/BadgeProvider';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <BadgeProvider>
      <SavedOpportunitiesProvider>
        <SavedCoursesProvider>
        <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
          <TopBar />
          <main className="pb-20 max-w-lg mx-auto">{children}</main>
          <BottomNav />
        </div>
        </SavedCoursesProvider>
      </SavedOpportunitiesProvider>
      </BadgeProvider>
    </ToastProvider>
  );
}
