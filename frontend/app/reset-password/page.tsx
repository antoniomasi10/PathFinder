'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">
            Reimposta password
          </h1>
          <p className="text-text-secondary">
            Inserisci il codice ricevuto via email e la nuova password
          </p>
        </div>

        <div className="card space-y-4">
          {error && (
            <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-green-500/10 text-green-400 rounded-xl px-4 py-3 text-sm text-center">
              Password reimpostata con successo! Reindirizzamento al login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="la.tua@email.it"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Codice di verifica</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Nuova password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="Minimo 8 caratteri, 1 maiuscola, 1 numero"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Conferma password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Ripeti la nuova password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'Reset in corso...' : 'Reimposta password'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-text-secondary">
            <Link href="/login" className="text-primary hover:underline">
              Torna al login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-text-secondary">Caricamento...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
