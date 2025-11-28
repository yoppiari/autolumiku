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

  // Extract potential tenant slug from various sources
  let tenantSlug: string | null = null;

  // 1. Check if custom domain (not localhost or vercel domain)
  const cleanHost = host.split(':')[0];
  if (
    !cleanHost.includes('localhost') &&
    !cleanHost.includes('127.0.0.1') &&
    !cleanHost.includes('.vercel.app')
  ) {
    // Custom domain - use subdomain or domain as slug hint
    const parts = cleanHost.split('.');
    if (parts.length >= 2) {
      tenantSlug = parts[0]; // subdomain becomes slug hint
    }
  }

  // 2. Check old catalog URL pattern: /catalog/[slug]
  if (pathname.startsWith('/catalog/')) {
    const slugMatch = pathname.match(/^\/catalog\/([^\/]+)/);
    if (slugMatch) {
      tenantSlug = slugMatch[1];
    }
  }

  // Add tenant slug hint to headers if found
  // Actual tenant validation will happen in server components with Prisma
  if (tenantSlug) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug-hint', tenantSlug);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    return response;
  }

  // No tenant slug hint - continue anyway
  return NextResponse.next();
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
