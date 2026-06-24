import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
      pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('refreshToken')?.value;
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // The backend is the source of truth for token validity: /api/bff/refresh and
  // every protected API call verify it server-side. When JWT_REFRESH_SECRET is
  // configured on the frontend we additionally verify the signature here at the
  // edge. When it isn't set we gate on cookie presence only — otherwise a missing
  // secret throws on every request and locks every signed-in user out of the app.
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(refreshSecret));
    return NextResponse.next();
  } catch {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
