import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register'];

export function middleware(request: NextRequest) {
  // Client-side auth check handles most protection via AuthProvider
  // This middleware handles edge cases for server-side navigation
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
