import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, extractRefreshToken, applyRefreshCookie } from '../_helpers';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('refreshToken')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Refresh token mancante' }, { status: 401 });
  }
  const backendRes = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `refreshToken=${token}` },
  });
  const data = await backendRes.json();
  const res = NextResponse.json(data, { status: backendRes.status });
  if (backendRes.ok) {
    const newToken = extractRefreshToken(backendRes.headers.get('set-cookie'));
    if (newToken) applyRefreshCookie(res, newToken);
  }
  return res;
}
