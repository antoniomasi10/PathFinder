'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'pf_cookie_notice_v1';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-700 flex-1 leading-relaxed">
          COhA usa cookie tecnici essenziali per il funzionamento del servizio (sessione autenticata).
          Non usiamo cookie di profilazione o tracciamento.{' '}
          <Link href="/privacy" className="text-[#615fe2] underline hover:text-[#5451d0]">
            Leggi l&apos;Informativa
          </Link>.
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 bg-[#615fe2] hover:bg-[#5451d0] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
