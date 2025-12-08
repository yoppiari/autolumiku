/**
 * Next.js Middleware
 * Handles tenant detection from custom domains and request routing
 *
 * NOTE: This runs on Edge Runtime, so we cannot use Prisma Client here.
 * Tenant detection is simplified - actual tenant validation happens in server components.
 */

import { NextRequest, NextResponse } from 'next/server';



export async function middleware(request: NextRequest) {
  console.log('[Middleware] Incoming request:', request.url);

  console.log(`[Middleware] Request: ${request.method} ${request.nextUrl.pathname}`);
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || 'localhost:3000';

  // Extract domain from Host header
  const cleanHost = host.split(':')[0]; // Remove port

  // Custom domain to slug mapping
  // TODO: Move to database or environment variable for dynamic mapping
  const domainToSlug: Record<string, string> = {
    'primamobil.id': 'primamobil',
    'www.primamobil.id': 'primamobil',
  };

  // Check if this is a custom tenant domain
  const tenantSlug = domainToSlug[cleanHost];
  const isCustomDomain = !!tenantSlug;
  const isPlatformDomain = cleanHost.includes('auto.lumiku.com');

  // Handle root path
  if (pathname === '/') {
    if (isCustomDomain) {
      // Custom domain: redirect to catalog
      console.log(`[Middleware] Custom domain ${cleanHost} detected, redirecting to catalog`);
      return NextResponse.redirect(new URL(`/catalog/${tenantSlug}`, request.url));
    } else if (isPlatformDomain || cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1')) {
      // Platform domain: redirect to login
      console.log('[Middleware] Platform domain detected, redirecting to /login');
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

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

  // Skip for localhost and development (if not already handled above)
  if (
    !isCustomDomain &&
    (cleanHost.includes('localhost') ||
    cleanHost.includes('127.0.0.1') ||
    cleanHost.includes('.vercel.app'))
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
