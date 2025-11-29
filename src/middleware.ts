/**
 * Next.js Middleware
 * Handles tenant detection from custom domains and request routing
 *
 * NOTE: This runs on Edge Runtime, so we cannot use Prisma Client here.
 * Tenant detection is simplified - actual tenant validation happens in server components.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || 'localhost:3000';

  // Skip middleware for:
  // - API routes (handled separately)
  // - Static files
  // - Admin panel
  // - Dashboard
  // - Auth routes
  // - Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/team') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Extract domain from Host header
  const cleanHost = host.split(':')[0]; // Remove port

  // Skip for localhost and development
  if (
    cleanHost.includes('localhost') ||
    cleanHost.includes('127.0.0.1') ||
    cleanHost.includes('.vercel.app')
  ) {
    return NextResponse.next();
  }

  // Set tenant domain hint for database lookup
  // All domains (subdomains, custom domains, etc.) are stored in Tenant.domain
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-domain', cleanHost);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
