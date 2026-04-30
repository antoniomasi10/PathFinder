'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuthButton from '@/components/GoogleAuthButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setAccessToken(data.accessToken);
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">
            Pathfinder
          </h1>
          <p className="text-text-secondary">Accedi al tuo account</p>
        </div>

        <div className="card space-y-4">
          {error && (
            <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <GoogleAuthButton />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-text-secondary text-sm">oppure</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

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
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm text-text-secondary">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Password dimenticata?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="La tua password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Non hai un account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
