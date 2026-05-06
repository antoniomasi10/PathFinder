'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = localStorage.getItem('accessToken');
      router.replace(token ? '/home' : '/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-jakarta"
      style={{ background: '#fbf8ff' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 188, height: 113 }}>
        <img
          src="/logo-coha-swash.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        <span
          className="relative z-10 font-extrabold text-[#2c3149] text-center select-none"
          style={{ fontSize: 74, letterSpacing: '-1.85px', lineHeight: 1, fontFamily: 'var(--font-plus-jakarta)' }}
        >
          CO&nbsp;&nbsp;&nbsp;A
        </span>
      </div>
      <p
        className="mt-2 text-[#595e78] text-center"
        style={{ fontSize: 13.5, letterSpacing: '0.34px', fontFamily: 'var(--font-plus-jakarta)' }}
      >
        University is not enough
      </p>
    </div>
  );
}
