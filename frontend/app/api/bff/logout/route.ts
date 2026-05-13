import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '../_helpers';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('refreshToken')?.value;
  if (token) {
    fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${token}` },
    }).catch(() => {});
  }
  const res = NextResponse.json({ message: 'Logout effettuato' });
  res.cookies.delete('refreshToken');
  return res;
}
