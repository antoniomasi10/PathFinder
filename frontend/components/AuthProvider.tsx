'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext, AuthUser } from '@/lib/auth';
import api, { clearAccessToken } from '@/lib/api';
import { useLanguage } from '@/lib/language';

const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // No localStorage check — the httpOnly refresh cookie is the session source of truth.
    // api.get('/profile/me') will auto-refresh via the 401 interceptor if the in-memory
    // access token is missing (e.g., after a page reload).
    api.get('/profile/me')
      .then(({ data }) => {
        setUser({
          id: data.id,
          name: data.name,
          surname: data.surname ?? '',
          phone: data.phone,
          email: data.email,
          avatar: data.avatar,
          profileCompleted: data.profileCompleted,
          emailVerified: data.emailVerified ?? true,
          provider: data.provider ?? 'LOCAL',
          university: data.university,
        });

        // Redirect based on verification and profile state
        if (!data.emailVerified && pathname !== '/verify-email') {
          router.replace('/verify-email');
        } else if (data.emailVerified && !data.profileCompleted && pathname !== '/onboarding') {
          router.replace('/onboarding');
        } else if (data.emailVerified && data.profileCompleted && ['/onboarding', '/verify-email'].includes(pathname)) {
          router.replace('/home');
        }
      })
      .catch(() => {
        // Refresh cookie also invalid — user is logged out
        clearAccessToken();
        if (!publicPaths.includes(pathname)) {
          router.replace('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    clearAccessToken();
    setUser(null);
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#fbf8ff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-coha-swash.svg" alt="COhA" style={{ width: 188, height: 113 }} className="object-contain pointer-events-none" />
        <p className="mt-2 text-center" style={{ fontSize: 13.5, letterSpacing: '0.34px', color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>
          University is not enough
        </p>
        <div className="mt-8 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full animate-bounce"
              style={{ width: 6, height: 6, backgroundColor: '#4a4bd7', opacity: 0.7, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
