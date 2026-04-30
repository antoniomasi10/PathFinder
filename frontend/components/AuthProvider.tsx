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
    // No localStorage check — token lives in memory only.
    // On first load the token is empty; the Axios interceptor will automatically
    // call /api/auth/refresh (using the httpOnly cookie) and set the in-memory
    // token before retrying /profile/me.
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
        // No valid session (no refresh cookie or cookie expired)
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
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-text-secondary">{t.common.loading}</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
