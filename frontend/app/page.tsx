'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Always attempt /home; AuthProvider will redirect to /login if there's no valid session.
    router.replace('/home');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-text-secondary">Caricamento...</div>
    </div>
  );
}
