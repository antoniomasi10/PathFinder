'use client';

import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { SavedOpportunitiesProvider } from '@/lib/savedOpportunities';
import { SavedCoursesProvider } from '@/lib/savedCourses';
import { ToastProvider } from '@/components/Toast';
import BadgeProvider from '@/components/BadgeProvider';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <BadgeProvider>
      <SavedOpportunitiesProvider>
        <SavedCoursesProvider>
        <div className="min-h-screen" style={{ backgroundColor: '#0D1117' }}>
          <TopBar />
          <main className="pb-20 max-w-lg mx-auto">
            <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
          </main>
          <BottomNav />
        </div>
        </SavedCoursesProvider>
      </SavedOpportunitiesProvider>
      </BadgeProvider>
    </ToastProvider>
  );
}
