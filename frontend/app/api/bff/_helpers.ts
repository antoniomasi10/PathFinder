import { NextResponse } from 'next/server';

export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function extractRefreshToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/refreshToken=([^;]+)/);
  return m ? m[1] : null;
}

export function applyRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
}
