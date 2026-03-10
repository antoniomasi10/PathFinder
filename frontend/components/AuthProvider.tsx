'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext, AuthUser } from '@/lib/auth';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';

const publicPaths = ['/login', '/register'];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
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
          email: data.email,
          avatar: data.avatar,
          profileCompleted: data.profileCompleted,
          university: data.university,
        });
        if (!data.profileCompleted && pathname !== '/onboarding') {
          router.replace('/onboarding');
        } else if (data.profileCompleted && pathname === '/onboarding') {
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
    localStorage.removeItem('accessToken');
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
