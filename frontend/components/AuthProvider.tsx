'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext, AuthUser } from '@/lib/auth';
import api, { clearAccessToken, bffPost, refreshSession } from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { identify, resetAnalytics } from '@/lib/analytics';

const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Use the shared singleton so this call and the Axios 401 interceptor
    // never fire two simultaneous backend refreshes with the same cookie.
    refreshSession()
      .then(() => api.get('/profile/me'))
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
        if (!data.emailVerified && pathname !== '/verify-email') {
          router.replace('/verify-email');
        } else if (data.emailVerified && !data.profileCompleted && pathname !== '/onboarding') {
          router.replace('/onboarding');
        } else if (data.emailVerified && data.profileCompleted && ['/onboarding', '/verify-email'].includes(pathname)) {
          router.replace('/home');
        }
      })
      .catch(() => {
        clearAccessToken();
        if (!publicPaths.includes(pathname)) {
          router.replace('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.email,
        universityId: user.university?.id,
        profileCompleted: user.profileCompleted,
      });
    }
  }, [user]);

  const logout = () => {
    bffPost('/api/bff/logout').catch(() => {});
    clearAccessToken();
    resetAnalytics();
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
