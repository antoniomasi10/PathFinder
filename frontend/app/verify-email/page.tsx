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

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
      setError(err.response?.data?.error || "Errore durante l'invio del codice");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'linear-gradient(90deg, #fbf8ff 0%, #fbf8ff 100%)' }}
    >
      <div
        className="w-full max-w-[342px] bg-white rounded-3xl p-6 flex flex-col items-center"
        style={{ boxShadow: '0px 3.054px 9.161px rgba(97, 95, 226, 0.06)' }}
      >
        {/* Heading */}
        <div className="flex flex-col items-center gap-1.5 w-full mb-6">
          <p className="font-[var(--font-plus-jakarta)] text-[#191b27] text-sm text-center">
            Verifica la tua email
          </p>
          <div className="flex flex-col items-center text-sm font-[var(--font-plus-jakarta)] text-[#464554] text-center">
            <span>Abbiamo inviato un codice a 6 cifre a</span>
            <span className="font-medium text-[#615fe2]">{user?.email}</span>
          </div>
        </div>

        {/* Error / success messages */}
        {error && (
          <div className="w-full mb-4 bg-red-50 text-red-500 rounded-xl px-4 py-2 text-xs text-center">
            {error}
          </div>
        )}
        {resendMessage && (
          <div className="w-full mb-4 bg-green-50 text-green-600 rounded-xl px-4 py-2 text-xs text-center">
            {resendMessage}
          </div>
        )}

        {/* OTP Input */}
        <div className="flex gap-1.5 justify-center w-full mb-6" onPaste={handlePaste}>
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
              disabled={loading}
              className="w-9 h-[42px] text-center text-sm font-[var(--font-plus-jakarta)] text-[#191b27] rounded-[6px] outline-none transition-colors"
              style={{
                background: '#e1e1f2',
                border: '0.763px solid #c7c4d6',
              }}
            />
          ))}
        </div>

        {/* Primary Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || code.some(d => d === '')}
          className="w-full py-3 rounded-3xl text-white text-sm font-[var(--font-plus-jakarta)] mb-6 transition-opacity disabled:opacity-50"
          style={{
            background: '#615fe2',
            boxShadow: '0px 0.763px 0.763px rgba(0,0,0,0.05)',
          }}
        >
          {loading ? 'Verifica in corso...' : 'Verifica'}
        </button>

        {/* Resend */}
        <p className="text-sm font-[var(--font-plus-jakarta)] text-[#464554] text-center">
          Non hai ricevuto il codice?{' '}
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="font-medium text-[#615fe2] disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Invia di nuovo tra ${resendCooldown}s` : 'Invia di nuovo'}
          </button>
        </p>
      </div>
    </div>
  );
}
