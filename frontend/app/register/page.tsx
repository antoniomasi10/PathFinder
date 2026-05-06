'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import SearchableSelect from '@/components/SearchableSelect';
import { italianCourses } from '@/data/italianCourses';

const LOGO_SWASH = '/logo-coha-swash.svg';

interface University {
  id: string;
  name: string;
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
      <path d="M1.5 6h9M7 2l4 4-4 4" stroke="#f7f4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InputField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between pl-1">
        <span className="text-xs font-medium text-[#464554] tracking-[0.5px]">{label}</span>
        {optional && (
          <span className="text-[10px] font-medium text-[#777585] tracking-[0.5px] uppercase">
            OPZIONALE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-[#fbf8ff] border border-[#c7c4d6] rounded-[24px] px-5 py-3.5 text-sm text-[#2c3149] placeholder:text-[#c7c4d6] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all ${props.className ?? ''}`}
    />
  );
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [universityId, setUniversityId] = useState('');
  const [courseOfStudy, setCourseOfStudy] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  useEffect(() => {
    api.get('/universities').then(({ data }) => setUniversities(data)).catch(() => {});
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
    if (!passwordValid) { setError('La password non soddisfa tutti i requisiti'); return; }
    if (!universityId) { setError('Seleziona la tua università'); return; }
    if (!courseOfStudy.trim()) { setError('Inserisci il tuo corso di studi'); return; }
    if (!accepted) { setError('Devi accettare i Termini di Servizio per continuare'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name, surname, email, password,
        phone: phone || undefined,
        universityId, courseOfStudy,
      });
      localStorage.setItem('accessToken', data.accessToken);
      setUser(data.user);
      router.push('/verify-email');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 pt-6 pb-10 font-jakarta"
      style={{ background: '#fbf8ff' }}>

      <div className="w-full max-w-[390px]">
        {/* Card */}
        <div className="bg-[#fbf8ff] border border-[#e6e7f8] rounded-[12px] shadow-[0px_8px_15px_rgba(72,68,200,0.06)] p-8 flex flex-col gap-6">

          {/* Logo */}
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center" style={{ width: 115, height: 69 }}>
              <img
                src={LOGO_SWASH}
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
              <span
                className="relative z-10 font-extrabold text-[#2c3149] text-center select-none"
                style={{ fontSize: 45, letterSpacing: '-1.13px', lineHeight: 1, fontFamily: 'var(--font-plus-jakarta)' }}
              >
                CO&nbsp;&nbsp;&nbsp;A
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[#191b27] mt-2 leading-8">Crea il tuo account</h1>
            <p className="text-sm text-[#464554] mt-1 text-center">Unisciti alla nostra community universitaria.</p>
          </div>

          {/* Errore */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* Nome / Cognome */}
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Nome">
                <AuthInput
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mario"
                  required
                />
              </InputField>
              <InputField label="Cognome">
                <AuthInput
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Rossi"
                  required
                />
              </InputField>
            </div>

            {/* Email */}
            <InputField label="Email">
              <AuthInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="m.rossi@studenti.uni.it"
                required
              />
            </InputField>

            {/* Password */}
            <InputField label="Password">
              <div className="relative">
                <AuthInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5 space-y-0.5 pl-1">
                  {[
                    { check: passwordChecks.length, label: 'Almeno 8 caratteri' },
                    { check: passwordChecks.upper, label: 'Una lettera maiuscola' },
                    { check: passwordChecks.lower, label: 'Una lettera minuscola' },
                    { check: passwordChecks.number, label: 'Un numero' },
                    { check: passwordChecks.special, label: 'Un carattere speciale (!@#$%...)' },
                  ].map(({ check, label }) => (
                    <p key={label} className={`text-xs flex items-center gap-1.5 ${check ? 'text-green-600' : 'text-[#777585]'}`}>
                      <span>{check ? '✓' : '✗'}</span> {label}
                    </p>
                  ))}
                </div>
              )}
            </InputField>

            {/* Telefono */}
            <InputField label="Telefono" optional>
              <AuthInput
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+39 333 1234567"
              />
            </InputField>

            {/* Università */}
            <InputField label="Università">
              <SearchableSelect
                options={universities.map((u) => ({ value: u.id, label: u.name }))}
                value={universityId}
                onChange={setUniversityId}
                placeholder="Cerca la tua università..."
                required
                inputClassName="w-full bg-[#fbf8ff] border border-[#c7c4d6] rounded-[24px] px-5 py-3.5 text-sm text-[#2c3149] placeholder:text-[#c7c4d6] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                dropdownClassName="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl bg-white border border-[#e6e7f8] shadow-lg"
                optionClassName="text-[#464554] hover:bg-[#f3f3fd]"
                optionActiveClassName="bg-[#615fe2]/10 text-[#615fe2]"
              />
            </InputField>

            {/* Corso di studi */}
            <InputField label="Corso di studi">
              <SearchableSelect
                options={italianCourses.map((c) => ({ value: c, label: c }))}
                value={courseOfStudy}
                onChange={setCourseOfStudy}
                placeholder="Cerca il tuo corso di studi..."
                required
                allowCustom
                inputClassName="w-full bg-[#fbf8ff] border border-[#c7c4d6] rounded-[24px] px-5 py-3.5 text-sm text-[#2c3149] placeholder:text-[#c7c4d6] focus:outline-none focus:ring-2 focus:ring-[#615fe2]/30 focus:border-[#615fe2] transition-all"
                dropdownClassName="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl bg-white border border-[#e6e7f8] shadow-lg"
                optionClassName="text-[#464554] hover:bg-[#f3f3fd]"
                optionActiveClassName="bg-[#615fe2]/10 text-[#615fe2]"
              />
            </InputField>

            {/* Terms */}
            <div className="flex items-start gap-3 py-1">
              <div className="pt-0.5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border border-[#c7c4d6] accent-[#615fe2] cursor-pointer"
                />
              </div>
              <label htmlFor="terms" className="text-sm text-[#464554] leading-[1.5] cursor-pointer">
                Accetto i{' '}
                <span className="font-medium text-[#615fe2]">Termini di Servizio</span>
                {' '}e confermo di aver letto l&apos;
                <span className="font-medium text-[#615fe2]">Informativa sulla Privacy</span>.
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !passwordValid}
              className="w-full flex items-center justify-center gap-2 bg-[#615fe2] hover:bg-[#5451d0] text-[#f7f4ff] rounded-[24px] py-4 text-xs font-medium tracking-[0.5px] transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Registrazione...' : 'Registrati'}</span>
              {!loading && <ArrowRightIcon />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-1 pb-4">
          <span className="text-sm text-[#464554]">Hai già un account?</span>
          <Link href="/login" className="font-semibold text-sm text-[#615fe2] hover:underline">
            Accedi
          </Link>
        </div>
      </div>
    </div>
  );
}
