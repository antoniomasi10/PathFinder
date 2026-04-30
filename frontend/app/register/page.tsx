'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import SearchableSelect from '@/components/SearchableSelect';
import { italianCourses } from '@/data/italianCourses';

interface University {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [courseOfStudy, setCourseOfStudy] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [tosConsent, setTosConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
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

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValid) {
      setError('La password non soddisfa tutti i requisiti');
      return;
    }

    if (!universityId) {
      setError('Seleziona la tua università');
      return;
    }

    if (!courseOfStudy.trim()) {
      setError('Inserisci il tuo corso di studi');
      return;
    }

    if (!tosConsent) {
      setError('Devi accettare i Termini di Servizio e la Privacy Policy per registrarti');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        name,
        surname,
        email,
        password,
        phone: phone || undefined,
        universityId,
        courseOfStudy,
        tosConsent,
        marketingConsent,
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
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
            {/* Nome e Cognome */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Mario"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Cognome</label>
                <input
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="input-field"
                  placeholder="Rossi"
                  required
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Telefono */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Telefono <span className="text-text-secondary/50">(opzionale)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="+39 333 1234567"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Crea una password sicura"
                required
              />
              {password && (
                <div className="mt-2 space-y-1">
                  {[
                    { check: passwordChecks.length, label: 'Almeno 8 caratteri' },
                    { check: passwordChecks.upper, label: 'Una lettera maiuscola' },
                    { check: passwordChecks.lower, label: 'Una lettera minuscola' },
                    { check: passwordChecks.number, label: 'Un numero' },
                    { check: passwordChecks.special, label: 'Un carattere speciale (!@#$%...)' },
                  ].map(({ check, label }) => (
                    <p key={label} className={`text-xs flex items-center gap-1.5 ${check ? 'text-green-400' : 'text-text-secondary/50'}`}>
                      <span>{check ? '\u2713' : '\u2717'}</span> {label}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Università */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Università
              </label>
              <SearchableSelect
                options={universities.map((uni) => ({ value: uni.id, label: uni.name }))}
                value={universityId}
                onChange={setUniversityId}
                placeholder="Cerca la tua università..."
                required
              />
            </div>

            {/* Corso di studi */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Corso di studi
              </label>
              <SearchableSelect
                options={italianCourses.map((c) => ({ value: c, label: c }))}
                value={courseOfStudy}
                onChange={setCourseOfStudy}
                placeholder="Cerca il tuo corso..."
                required
                allowCustom
              />
            </div>

            {/* GDPR consent */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosConsent}
                  onChange={(e) => setTosConsent(e.target.checked)}
                  className="mt-0.5 accent-primary flex-shrink-0"
                  required
                />
                <span className="text-sm text-text-secondary">
                  Ho letto e accetto i{' '}
                  <a href="/terms" className="text-primary underline" target="_blank" rel="noopener noreferrer">Termini di Servizio</a>
                  {' '}e la{' '}
                  <a href="/privacy" className="text-primary underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                  {' '}<span className="text-error">*</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 accent-primary flex-shrink-0"
                />
                <span className="text-sm text-text-secondary">
                  Acconsento a ricevere comunicazioni di marketing e aggiornamenti sulle opportunità (opzionale)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !passwordValid || !tosConsent}
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
