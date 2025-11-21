import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/services/tenant-service';
import { Tenant } from '@/types/tenant';

/**
 * Tenant resolution middleware for subdomain-based routing
 */
export interface TenantContext {
  tenant: Tenant | null;
  subdomain: string | null;
  isPublicRoute: boolean;
  isAdminRoute: boolean;
}

/**
 * Extract tenant from request
 */
export async function extractTenantFromRequest(request: NextRequest): Promise<TenantContext> {
  try {
    const hostname = request.headers.get('host') || '';
    const pathname = request.nextUrl.pathname;

    // Check if this is an admin route
    const isAdminRoute = pathname.startsWith('/admin/');

    // Check if this is a public route (doesn't require tenant context)
    const isPublicRoute = isPublicPath(pathname);

    // For admin routes, no tenant resolution needed
    if (isAdminRoute) {
      return {
        tenant: null,
        subdomain: null,
        isPublicRoute,
        isAdminRoute
      };
    }

    // For public routes, no tenant resolution needed
    if (isPublicRoute) {
      return {
        tenant: null,
        subdomain: null,
        isPublicRoute,
        isAdminRoute
      };
    }

    // Extract subdomain from hostname
    const subdomain = extractSubdomain(hostname);

    if (!subdomain) {
      return {
        tenant: null,
        subdomain: null,
        isPublicRoute: true, // No subdomain means public access
        isAdminRoute
      };
    }

    // Get tenant by subdomain
    const tenant = await tenantService.getTenantBySubdomain(subdomain);

    return {
      tenant,
      subdomain,
      isPublicRoute: false,
      isAdminRoute
    };

  } catch (error) {
    console.error('Error extracting tenant from request:', error);
    return {
      tenant: null,
      subdomain: null,
      isPublicRoute: true,
      isAdminRoute: false
    };
  }
}

/**
 * Tenant resolution middleware
 */
export function withTenantResolution(handler: (req: NextRequest, context: TenantContext) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const context = await extractTenantFromRequest(request);

    // Handle tenant not found for non-public routes
    if (!context.isPublicRoute && !context.isAdminRoute && context.subdomain && !context.tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Handle suspended tenants
    if (context.tenant && context.tenant.status === 'suspended') {
      return NextResponse.json(
        { error: 'Tenant account is suspended' },
        { status: 403 }
      );
    }

    // Handle inactive tenants
    if (context.tenant && context.tenant.status === 'setup_required') {
      return NextResponse.json(
        { error: 'Tenant setup is not complete' },
        { status: 503 }
      );
    }

    // Add tenant context to request headers for downstream use
    const requestWithTenant = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-tenant-id': context.tenant?.id || '',
        'x-tenant-subdomain': context.subdomain || '',
        'x-tenant-status': context.tenant?.status || '',
        'x-is-admin-route': context.isAdminRoute.toString(),
        'x-is-public-route': context.isPublicRoute.toString()
      }
    }) as NextRequest;

    return handler(requestWithTenant, context);
  };
}

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0];

  // Extract domain parts
  const parts = hostWithoutPort.split('.');

  // Need at least 3 parts to have a subdomain (sub.domain.com)
  if (parts.length < 3) {
    return null;
  }

  // Get the first part as subdomain
  const subdomain = parts[0].toLowerCase();

  // Handle common cases
  if (subdomain === 'www' || subdomain === 'localhost') {
    return null;
  }

  return subdomain;
}

/**
 * Check if path is public (doesn't require tenant context)
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/',
    '/api/auth',
    '/api/health',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/pricing'
  ];

  // Check exact matches
  if (publicPaths.includes(pathname)) {
    return true;
  }

  // Check if path starts with any public path
  for (const publicPath of publicPaths) {
    if (pathname.startsWith(publicPath + '/')) {
      return true;
    }
  }

  // Check for static assets
  if (pathname.startsWith('/_next/') ||
      pathname.startsWith('/static/') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/css/') ||
      pathname.startsWith('/js/') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.css') ||
      pathname.endsWith('.js')) {
    return true;
  }

  return false;
}

/**
 * Validate subdomain format
 */
export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain || subdomain.trim().length === 0) {
    return { valid: false, error: 'Subdomain is required' };
  }

  const cleaned = subdomain.toLowerCase().trim();

  // Length validation
  if (cleaned.length < 3) {
    return { valid: false, error: 'Subdomain must be at least 3 characters long' };
  }

  if (cleaned.length > 63) {
    return { valid: false, error: 'Subdomain must be less than 64 characters' };
  }

  // Format validation (letters, numbers, hyphens only)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Subdomain can only contain letters, numbers, and hyphens. Must start and end with letter or number.'
    };
  }

  // No consecutive hyphens
  if (cleaned.includes('--')) {
    return { valid: false, error: 'Subdomain cannot contain consecutive hyphens' };
  }

  // Reserved subdomains
  const reservedSubdomains = [
    'www', 'api', 'admin', 'mail', 'ftp', 'localhost', 'autolumiku',
    'app', 'blog', 'shop', 'store', 'support', 'help', 'status',
    'docs', 'cdn', 'assets', 'static', 'media', 'test', 'staging',
    'dev', 'development', 'prod', 'production', 'demo', 'example'
  ];

  if (reservedSubdomains.includes(cleaned)) {
    return { valid: false, error: 'This subdomain is reserved for system use' };
  }

  // Inappropriate content check
  const inappropriateTerms = [
    'spam', 'abuse', 'hate', 'violence', 'illegal', 'fraud',
    'scam', 'phishing', 'malware', 'virus', 'adult', 'xxx'
  ];

  for (const term of inappropriateTerms) {
    if (cleaned.includes(term)) {
      return { valid: false, error: 'Subdomain contains inappropriate content' };
    }
  }

  return { valid: true };
}

/**
 * Generate available subdomain suggestions
 */
export function generateSubdomainSuggestions(businessName: string): string[] {
  if (!businessName || businessName.trim().length === 0) {
    return [];
  }

  const base = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  const suggestions: string[] = [];

  // Original cleaned name
  if (base.length >= 3) {
    suggestions.push(base);
  }

  // Add location-based suggestions
  const locations = ['jakarta', 'surabaya', 'bandung', 'medan', 'semarang'];
  for (const location of locations) {
    if (base.length > 0) {
      suggestions.push(`${base}-${location}`);
    }
  }

  // Add industry-based suggestions
  const industries = ['motor', 'mobil', 'car', 'auto', 'showroom'];
  for (const industry of industries) {
    if (base.length > 0) {
      suggestions.push(`${base}-${industry}`);
    }
  }

  // Add number-based suggestions
  for (let i = 1; i <= 3; i++) {
    suggestions.push(`${base}${i}`);
  }

  // Filter and limit suggestions
  return suggestions
    .filter(s => s.length >= 3 && s.length <= 63)
    .slice(0, 8);
}

/**
 * Check subdomain availability
 */
export async function checkSubdomainAvailability(subdomain: string): Promise<{ available: boolean; tenant?: Tenant }> {
  try {
    const tenant = await tenantService.getTenantBySubdomain(subdomain);
    return {
      available: !tenant,
      tenant: tenant || undefined
    };
  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    return { available: false };
  }
}