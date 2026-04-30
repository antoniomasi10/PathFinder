'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'cookie_notice_dismissed';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 pointer-events-none">
      <div className="max-w-lg mx-auto bg-[#1E293B] border border-white/10 rounded-2xl p-4 shadow-xl pointer-events-auto">
        <p className="text-sm text-[#94A3B8] mb-3">
          Utilizziamo solo cookie tecnici necessari al funzionamento del servizio (autenticazione).
          Nessun cookie di profilazione o tracciamento.{' '}
          <Link href="/privacy" className="text-[#4F46E5] hover:underline">Privacy Policy</Link>
        </p>
        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-xl bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
