'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
    // Fetch universities for dropdown (public endpoint alternative - fallback to empty)
    api.get('/universities').then(({ data }) => {
      setUniversities(data);
    }).catch(() => {});
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
      router.push('/onboarding');
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

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

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
              placeholder="Minimo 6 caratteri"
              minLength={6}
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

          <p className="text-center text-sm text-text-secondary">
            Hai già un account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
