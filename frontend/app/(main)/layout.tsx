'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { SavedOpportunitiesProvider } from '@/lib/savedOpportunities';
import { SavedCoursesProvider } from '@/lib/savedCourses';
import { ToastProvider } from '@/components/Toast';
import BadgeProvider from '@/components/BadgeProvider';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { NotificationProvider } from '@/lib/notificationContext';
import { isPushSupported, subscribeToPush } from '@/lib/pushManager';
import SkillsPromptProvider from '@/components/SkillsPromptSheet';
import { Bell } from '@/components/icons';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'Errore sconosciuto';
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white p-4">
      <h2 className="text-xl font-bold mb-2">Qualcosa è andato storto</h2>
      <p className="text-gray-400 mb-4">{message}</p>
      <button onClick={resetErrorBoundary} className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700">
        Riprova
      </button>
    </div>
  );
}

function PushPromptModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (localStorage.getItem('pushPromptShown')) return;
    if (Notification.permission !== 'default') {
      localStorage.setItem('pushPromptShown', 'true');
      return;
    }
    // Small delay so it doesn't flash immediately
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeToPush();
    }
    localStorage.setItem('pushPromptShown', 'true');
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pushPromptShown', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" onClick={handleDismiss} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[#161B22] rounded-2xl p-6 max-w-sm w-full pointer-events-auto shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#4F46E5]/20 flex items-center justify-center mx-auto mb-4">
            <Bell size={28} strokeWidth={2} className="text-[#4F46E5]" />
          </div>
          <h3 className="text-white font-bold text-lg text-center mb-2">Resta aggiornato</h3>
          <p className="text-[#94A3B8] text-sm text-center mb-6">
            Attiva le notifiche per non perdere nuove opportunit&agrave;, scadenze importanti e aggiornamenti dalla community.
          </p>
          <button
            onClick={handleEnable}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] transition-colors mb-3"
          >
            Attiva notifiche
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
          >
            Non ora
          </button>
        </div>
      </div>
    </>
  );
}

const FULLSCREEN_ROUTES = ['/profile/skills'];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);

  return (
    <ToastProvider>
      <NotificationProvider>
      <BadgeProvider>
      <SavedOpportunitiesProvider>
        <SavedCoursesProvider>
        <SkillsPromptProvider>
        <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
          {!isFullscreen && <TopBar />}
          <main className={`${isFullscreen ? '' : 'pb-20'} max-w-lg mx-auto`}>
            <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
          </main>
          {!isFullscreen && <BottomNav />}
          {!isFullscreen && <PushPromptModal />}
        </div>
        </SkillsPromptProvider>
        </SavedCoursesProvider>
      </SavedOpportunitiesProvider>
      </BadgeProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
