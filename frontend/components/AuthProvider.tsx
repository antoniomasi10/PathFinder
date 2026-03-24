'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext, AuthUser } from '@/lib/auth';
import api from '@/lib/api';

const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      if (!publicPaths.includes(pathname)) {
        router.replace('/login');
      }
      return;
    }

    api.get('/profile/me')
      .then(({ data }) => {
        setUser({
          id: data.id,
          name: data.name,
          surname: data.surname ?? '',
          username: data.username ?? '',
          phone: data.phone,
          email: data.email,
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
        localStorage.removeItem('accessToken');
        if (!publicPaths.includes(pathname)) {
          router.replace('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('accessToken');
    setUser(null);
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-text-secondary">Caricamento...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
