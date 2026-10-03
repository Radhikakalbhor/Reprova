import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname, search } = req.nextUrl;
  const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/signup');
  const isProtectedPage = pathname.startsWith('/analyze') || pathname.startsWith('/results');

  // If user is already authenticated and visits signin or signup, redirect to /analyze
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/analyze', req.url));
  }

  // If user is not authenticated and attempts to access protected routes,
  // redirect to /signin while preserving the full original URL including query parameters
  if (!token && isProtectedPage) {
    const originalUrl = `${pathname}${search}`;
    const signinUrl = new URL('/signin', req.url);
    signinUrl.searchParams.set('callbackUrl', originalUrl);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/analyze/:path*', '/results/:path*', '/signin', '/signup'],
};
