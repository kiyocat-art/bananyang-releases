import { NextRequest, NextResponse } from 'next/server';

const ALLOW_PREFIXES = [
  '/admin',
  '/auth/login',
  '/api',
  '/maintenance',
  '/_next',
  '/favicon',
  '/icon',
  '/apple-icon',
];

export function proxy(req: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'on') {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (ALLOW_PREFIXES.some(p =>
    pathname === p ||
    pathname.startsWith(p + '/') ||
    pathname.startsWith(p + '.')
  )) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = '/maintenance';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
