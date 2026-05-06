'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

const LOGO = '/logo-coha-swash.svg';

function MailIcon() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="none">
      <rect x="0.5" y="0.5" width="16" height="13" rx="1.5" stroke="#747995" />
      <path d="M1 1.5L8.5 8L16 1.5" stroke="#747995" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6h9M7 2l4 4-4 4" stroke="#fbf7ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante l\'invio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 pt-16 pb-10 font-jakarta"
      style={{ background: '#fbf8ff' }}
    >
      <div className="w-full max-w-[363px]">
        <div className="relative bg-[rgba(206,205,205,0.12)] border border-[rgba(0,0,0,0.33)] rounded-[24px] shadow-[2px_2px_14.7px_1px_rgba(0,0,0,0.25)] px-6 pt-16 pb-7 flex flex-col items-center">

          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img
              src={LOGO}
              alt="COA"
              style={{ width: 297, height: 85 }}
              className="object-contain pointer-events-none"
            />
          </div>

          {/* Heading */}
          <div className="text-center mb-7 w-full">
            <h1 className="text-2xl font-semibold text-[#2c3149] leading-8">Password dimenticata</h1>
            <p className="text-sm text-[#595e78] mt-0.5">Inserisci la tua email per ricevere un codice di reset</p>
          </div>

          {/* Error */}
          {error && (
            <div className="w-full mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="w-full bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm text-center mb-4">
              Email inviata! Controlla la tua casella. Reindirizzamento in corso...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-[10px] mt-1 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">E-mail</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Inserisci la tua e-mail"
                    required
                    className="w-full bg-[#fbf8ff] border border-[#acb0ce] rounded-[24px] pl-[45px] pr-4 py-4 text-sm text-[#2c3149] placeholder:text-[#747995] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#615fe2] hover:bg-[#5451d0] text-[#fbf7ff] rounded-[24px] px-4 py-3.5 text-xs font-medium tracking-[0.5px] transition-colors disabled:opacity-50 drop-shadow-sm"
              >
                <span>{loading ? 'Invio...' : 'Invia codice di reset'}</span>
                {!loading && <ArrowRightIcon />}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-1">
          <span className="text-sm text-[#595e78]">Ricordi la password?</span>
          <Link href="/login" className="text-xs font-medium text-[#615fe2] tracking-[0.5px] hover:underline">
            Accedi
          </Link>
        </div>
      </div>
    </div>
  );
}
