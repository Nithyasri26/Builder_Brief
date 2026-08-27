import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

/**
 * Gate for the citizen-facing pages. Anything not matched below (the auth
 * pages, API routes, Next internals and static assets) is public; everything
 * else requires a session cookie, redirecting to /login when absent.
 *
 * This is a cheap presence check — full signature/expiry verification happens
 * server-side wherever data is actually read.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|assets|.*\\..*).*)'],
};
