'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { SavedOpportunitiesProvider } from '@/lib/savedOpportunities';
import { SavedCoursesProvider } from '@/lib/savedCourses';
import { ToastProvider } from '@/components/Toast';
import BadgeProvider from '@/components/BadgeProvider';
import { NotificationProvider } from '@/lib/notificationContext';
import { isPushSupported, subscribeToPush } from '@/lib/pushManager';

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
            <svg className="w-7 h-7 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NotificationProvider>
      <BadgeProvider>
      <SavedOpportunitiesProvider>
        <SavedCoursesProvider>
        <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
          <TopBar />
          <main className="pb-20 max-w-lg mx-auto">{children}</main>
          <BottomNav />
          <PushPromptModal />
        </div>
        </SavedCoursesProvider>
      </SavedOpportunitiesProvider>
      </BadgeProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
