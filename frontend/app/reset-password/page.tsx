'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2L4 14M12 2L10 14M2 6h12M2 10h12" stroke="#747995" strokeWidth="1.5" strokeLinecap="round" />
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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    if (newPassword.length < 8) {
      setError('La password deve avere almeno 8 caratteri');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('La password deve contenere almeno una lettera maiuscola');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('La password deve contenere almeno un numero');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il reset della password');
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
            <h1 className="text-2xl font-semibold text-[#2c3149] leading-8">Reimposta password</h1>
            <p className="text-sm text-[#595e78] mt-0.5">Inserisci il codice ricevuto e la nuova password</p>
          </div>

          {/* Error */}
          {error && (
            <div className="w-full mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="w-full bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm text-center mb-4">
              Password reimpostata! Reindirizzamento al login...
            </div>
          ) : (
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

              {/* Codice */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">Codice di verifica</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <CodeIcon />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full bg-[#fbf8ff] border border-[#acb0ce] rounded-[24px] pl-[45px] pr-4 py-4 text-sm text-[#2c3149] placeholder:text-[#747995] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all text-center tracking-[0.4em]"
                  />
                </div>
              </div>

              {/* Nuova password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">Nuova password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 8 caratteri, 1 maiuscola, 1 numero"
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
              </div>

              {/* Conferma password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#2c3149] tracking-[0.5px]">Conferma password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon />
                  </span>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password"
                    required
                    className="w-full bg-[#fbf8ff] border border-[#acb0ce] rounded-[24px] pl-[45px] pr-12 py-4 text-sm text-[#2c3149] placeholder:text-[#747995] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#615fe2] hover:bg-[#5451d0] text-[#fbf7ff] rounded-[24px] px-4 py-3.5 text-xs font-medium tracking-[0.5px] transition-colors disabled:opacity-50 drop-shadow-sm"
              >
                <span>{loading ? 'Reset in corso...' : 'Reimposta password'}</span>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbf8ff' }}>
        <div className="text-sm text-[#595e78] font-jakarta">Caricamento...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
