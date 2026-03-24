'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function VerifyEmailPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user?.emailVerified) {
      router.replace(user.profileCompleted ? '/home' : '/onboarding');
    }
  }, [user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(d => d !== '') && value) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (codeStr?: string) => {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      setError('Inserisci il codice completo di 6 cifre');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-email', { code: fullCode });
      if (user) {
        setUser({ ...user, emailVerified: true });
      }
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Codice non valido');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      await api.post('/auth/resend-otp');
      setResendMessage('Nuovo codice inviato!');
      setResendCooldown(60);
      setError('');
      setTimeout(() => setResendMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante l\'invio del codice');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">
            Verifica la tua email
          </h1>
          <p className="text-text-secondary">
            Abbiamo inviato un codice a 6 cifre a{' '}
            <span className="text-primary font-medium">{user?.email}</span>
          </p>
        </div>

        <div className="card space-y-6">
          {error && (
            <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="bg-green-500/10 text-green-400 rounded-xl px-4 py-3 text-sm">
              {resendMessage}
            </div>
          )}

          {/* OTP Input */}
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-surface border-2 border-white/10 rounded-xl text-text-primary focus:border-primary focus:outline-none transition-colors"
                disabled={loading}
              />
            ))}
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={loading || code.some(d => d === '')}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Verifica in corso...' : 'Verifica'}
          </button>

          <div className="text-center">
            <p className="text-sm text-text-secondary mb-2">
              Non hai ricevuto il codice?
            </p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-primary hover:underline text-sm disabled:text-text-secondary disabled:no-underline"
            >
              {resendCooldown > 0
                ? `Invia di nuovo tra ${resendCooldown}s`
                : 'Invia di nuovo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
