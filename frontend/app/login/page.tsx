'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuthButton from '@/components/GoogleAuthButton';

const LOGO_SWASH = '/logo-coha-swash.svg';
const APPLE_ICON = '/icon-apple.svg';

function MailIcon() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="none">
      <rect x="0.5" y="0.5" width="16" height="13" rx="1.5" stroke="#747995" />
      <path d="M1 1.5L8.5 8L16 1.5" stroke="#747995" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
      <rect x="1" y="7.5" width="12" height="10" rx="1.5" stroke="#747995" />
      <path d="M3.5 7.5V5.5a3.5 3.5 0 017 0v2" stroke="#747995" strokeLinecap="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="19" height="17" viewBox="0 0 19 17" fill="none">
      <path d="M2 2l15 13" stroke="#747995" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.3 4.2A6.5 6.5 0 0116.5 8.5c-.6 1.2-1.5 2.2-2.6 2.9M5 6A6.5 6.5 0 002.5 8.5C3.8 11.5 6.5 13.5 9.5 13.5a7 7 0 003-.7" stroke="#747995" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="19" height="13" viewBox="0 0 19 13" fill="none">
      <path d="M1.5 6.5C2.8 3 5.9 1 9.5 1s6.7 2 8 5.5c-1.3 3.5-4.4 5.5-8 5.5s-6.7-2-8-5.5z" stroke="#747995" strokeWidth="1.5" />
      <circle cx="9.5" cy="6.5" r="2.5" stroke="#747995" strokeWidth="1.5" />
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      setUser(data.user);
      if (!data.user.emailVerified) {
        router.push('/verify-email');
      } else if (!data.user.profileCompleted) {
        router.push('/onboarding');
      } else {
        router.push('/home');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 pt-16 pb-10 font-jakarta"
      style={{ background: '#fbf8ff' }}>

      <div className="w-full max-w-[363px]">
        {/* Card */}
        <div className="relative bg-[rgba(206,205,205,0.12)] border border-[rgba(0,0,0,0.33)] rounded-[24px] shadow-[2px_2px_14.7px_1px_rgba(0,0,0,0.25)] px-6 pt-16 pb-7 flex flex-col items-center">

          {/* Logo */}
          <div className="relative flex items-center justify-center mb-6" style={{ width: 134, height: 80 }}>
            <img
              src={LOGO_SWASH}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            <span
              className="relative z-10 font-extrabold text-[#2c3149] text-center select-none"
              style={{ fontSize: 52, letterSpacing: '-1.32px', lineHeight: 1, fontFamily: 'var(--font-plus-jakarta)' }}
            >
              CO&nbsp;&nbsp;&nbsp;A
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-7 w-full">
            <h1 className="text-2xl font-semibold text-[#2c3149] leading-8">Benvenuto</h1>
            <p className="text-sm text-[#595e78] mt-0.5">Accedi al tuo account per continuare</p>
          </div>

          {/* Errore */}
          {error && (
            <div className="w-full mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Google */}
          <div className="w-full mb-2">
            <GoogleAuthButton />
          </div>

          {/* Apple */}
          <div className="w-full mb-6">
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-3 bg-[#fbf8ff] border border-[#acb0ce] rounded-[24px] px-[17px] py-[13px] opacity-50 cursor-not-allowed"
            >
              <img src={APPLE_ICON} alt="" className="w-5 h-5" />
              <span className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">Accedi con Apple</span>
            </button>
          </div>

          {/* Divider */}
          <div className="w-full flex items-center mb-1">
            <div className="flex-1 h-px bg-[#e4e7ff]" />
            <span className="px-4 text-sm text-[#595e78]">oppure</span>
            <div className="flex-1 h-px bg-[#e4e7ff]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-[10px] mt-1 mb-4">
            {/* Email */}
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

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci la tua password"
                  required
                  className="w-full bg-[#fbf8ff] border border-[#acb0ce] rounded-[24px] pl-[45px] pr-12 py-4 text-sm text-[#2c3149] placeholder:text-[#747995] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#615fe2] tracking-[0.5px] hover:underline"
                >
                  Password dimenticata?
                </Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#615fe2] hover:bg-[#5451d0] text-[#fbf7ff] rounded-[24px] px-4 py-3.5 text-xs font-medium tracking-[0.5px] transition-colors disabled:opacity-50 drop-shadow-sm"
            >
              <span>{loading ? 'Accesso...' : 'Accedi'}</span>
              {!loading && <ArrowRightIcon />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-1">
          <span className="text-sm text-[#595e78]">Non hai un account?</span>
          <Link href="/register" className="text-xs font-medium text-[#615fe2] tracking-[0.5px] hover:underline">
            Registrati
          </Link>
        </div>
      </div>
    </div>
  );
}
