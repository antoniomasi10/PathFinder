'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

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
      // Navigate to reset page with email pre-filled
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">
            Password dimenticata
          </h1>
          <p className="text-text-secondary">
            Inserisci la tua email e ti invieremo un codice per reimpostare la password
          </p>
        </div>

        <div className="card space-y-4">
          {error && (
            <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="bg-green-500/10 text-green-400 rounded-xl px-4 py-3 text-sm text-center">
              Se l'email è registrata, riceverai un codice di reset. Reindirizzamento in corso...
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

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'Invio...' : 'Invia codice di reset'}
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
