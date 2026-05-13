import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, extractRefreshToken, applyRefreshCookie } from '../_helpers';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await backendRes.json();
  const res = NextResponse.json(data, { status: backendRes.status });
  if (backendRes.ok) {
    const token = extractRefreshToken(backendRes.headers.get('set-cookie'));
    if (token) applyRefreshCookie(res, token);
  }
  return res;
}
