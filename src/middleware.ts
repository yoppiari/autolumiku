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

  // FIRST: Proxy URL-encoded static chunk files to API route
  // Next.js standalone has a bug with symlinks in multi-threaded environment
  // Middleware Edge Runtime doesn't support Node.js fs APIs
  // Solution: Rewrite to API route that has full Node.js runtime
  if (pathname.startsWith('/_next/static/') && (pathname.includes('%5B') || pathname.includes('%5D'))) {
    const staticPath = pathname.replace('/_next/static/', '');
    const url = request.nextUrl.clone();
    url.pathname = `/api/static-proxy/${staticPath}`;

    console.log(`[Middleware] Proxying to API: ${pathname} -> ${url.pathname}`);

    return NextResponse.rewrite(url);
  }

  // Extract domain from Host header
  const cleanHost = host.split(':')[0]; // Remove port

  // Custom domain to slug mapping
  // TODO: Move to database or environment variable for dynamic mapping
  const domainToSlug: Record<string, string> = {
    'primamobil.id': 'primamobil-id',
    'www.primamobil.id': 'primamobil-id',
  };

  // Check if this is a custom tenant domain
  const tenantSlug = domainToSlug[cleanHost];
  const isCustomDomain = !!tenantSlug;
  const isPlatformDomain = cleanHost.includes('auto.lumiku.com');

  // Skip middleware for:
  // - API routes (handled separately)
  // - Static files (but NOT _next/static/ with encoded brackets - handled above)
  // - Admin panel
  // - Dashboard
  // - Auth routes
  // - Next.js internals
  // - Catalog routes (already in correct format)
  if (
    pathname.startsWith('/api/') ||
    (pathname.startsWith('/_next/') && !(pathname.includes('%5B') || pathname.includes('%5D'))) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/team') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/catalog/') ||
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

  // Handle custom domain routing
  if (isCustomDomain) {
    // Set custom headers for downstream detection
    requestHeaders.set('x-tenant-slug', tenantSlug);
    requestHeaders.set('x-is-custom-domain', 'true');
    requestHeaders.set('x-original-path', pathname);

    console.log(`[Middleware V2] Custom domain ${cleanHost} - Path: ${pathname}`);

    // Rewrite URL to internal catalog path
    // primamobil.id/vehicles -> /catalog/primamobil-id/vehicles
    const url = request.nextUrl.clone();
    // Rewrite to the tenant's catalog page
    // Ensure we don't end up with double slashes or trailing slashes for root
    const newPathname = url.pathname === '/'
      ? `/catalog/${tenantSlug}`
      : `/catalog/${tenantSlug}${url.pathname}`;

    url.pathname = newPathname;
    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Platform domain: pass through with headers
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
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     *
     * NOTE: We INCLUDE _next/static to handle URL decoding for dynamic route chunks
     */
    '/((?!api|_next/image|favicon.ico).*)',
  ],
};
