import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Verifica apenas a *presença* do cookie de sessão (zero DB hit).
 * A validação real acontece nas Server Actions / Server Components que
 * chamam `auth.api.getSession(...)`. Recomendado pela própria Better Auth:
 * https://better-auth.com/docs/integrations/next#middleware
 */
export function middleware(request: NextRequest): NextResponse {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/documents/:path*'],
};
