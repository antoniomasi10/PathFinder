'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuthButton from '@/components/GoogleAuthButton';

interface University {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [courseOfStudy, setCourseOfStudy] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  useEffect(() => {
    api.get('/universities').then(({ data }) => {
      setUniversities(data);
    }).catch((err) => {
      console.error('Failed to fetch universities:', err);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        name, email, password, universityId: universityId || undefined, courseOfStudy: courseOfStudy || undefined,
      });
      localStorage.setItem('accessToken', data.accessToken);
      setUser(data.user);
      // Redirect to email verification (OTP)
      router.push('/verify-email');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">
            Pathfinder
          </h1>
          <p className="text-text-secondary">Crea il tuo account</p>
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
              <label className="block text-sm text-text-secondary mb-1.5">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Mario Rossi"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="mario.rossi@email.it"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min 8 caratteri, 1 maiuscola, 1 numero"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Università</label>
              <select
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                className="input-field"
              >
                <option value="">Seleziona università</option>
                {universities.map((uni) => (
                  <option key={uni.id} value={uni.id}>{uni.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Corso di studi</label>
              <input
                type="text"
                value={courseOfStudy}
                onChange={(e) => setCourseOfStudy(e.target.value)}
                className="input-field"
                placeholder="es. Informatica"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Registrazione...' : 'Registrati'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Hai già un account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
