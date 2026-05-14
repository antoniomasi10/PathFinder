'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';

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
  const { t } = useLanguage();

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
      setError(err.response?.data?.error || t.auth.forgotTitle);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 pt-16 pb-10 font-jakarta"
      style={{ background: '#fbf8ff' }}
    >
      <div className="w-full max-w-[22.6875rem]">
        <div className="relative bg-[rgba(206,205,205,0.12)] border border-[rgba(0,0,0,0.33)] rounded-[1.5rem] shadow-[2px_2px_14.7px_1px_rgba(0,0,0,0.25)] px-6 pt-16 pb-7 flex flex-col items-center">

          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img
              src={LOGO}
              alt="COhA"
              style={{ width: '18.5625rem', height: '5.3125rem' }}
              className="object-contain pointer-events-none"
            />
          </div>

          {/* Heading */}
          <div className="text-center mb-7 w-full">
            <h1 className="text-2xl font-semibold text-[#2c3149] leading-8">{t.auth.forgotTitle}</h1>
            <p className="text-sm text-[#595e78] mt-0.5">{t.auth.forgotSub}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="w-full mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="w-full bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm text-center mb-4">
              {t.auth.forgotEmailSent}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-[0.625rem] mt-1 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#2c3149] tracking-[0.03125rem]">{t.security.emailLabel}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.security.emailPlaceholder}
                    required
                    className="w-full bg-[#fbf8ff] border border-[#acb0ce] rounded-[1.5rem] pl-[2.8125rem] pr-4 py-4 text-sm text-[#2c3149] placeholder:text-[#747995] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#615fe2] hover:bg-[#5451d0] text-[#fbf7ff] rounded-[1.5rem] px-4 py-3.5 text-xs font-medium tracking-[0.03125rem] transition-colors disabled:opacity-50 drop-shadow-sm"
              >
                <span>{loading ? t.auth.sending : t.auth.forgotSendBtn}</span>
                {!loading && <ArrowRightIcon />}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-1">
          <span className="text-sm text-[#595e78]">{t.auth.rememberPwd}</span>
          <Link href="/login" className="text-xs font-medium text-[#615fe2] tracking-[0.03125rem] hover:underline">
            {t.auth.backToLogin}
          </Link>
        </div>
      </div>
    </div>
  );
}
