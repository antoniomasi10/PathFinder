'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = getAccessToken();
      router.replace(token ? '/home' : '/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-jakarta"
      style={{ background: '#fbf8ff' }}
    >
      <img
        src="/logo-coha-swash.svg"
        alt="COA"
        style={{ width: '11.75rem', height: '7.0625rem' }}
        className="object-contain pointer-events-none"
      />
      <p
        className="mt-2 text-[#595e78] text-center"
        style={{ fontSize: '0.84375rem', letterSpacing: '0.02125rem', fontFamily: 'var(--font-plus-jakarta)' }}
      >
        University is not enough
      </p>
    </div>
  );
}
