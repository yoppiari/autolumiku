/**
 * Tenant Helper Functions
 * Utilities for working with tenant context in Next.js pages
 */

import { headers } from 'next/headers';
import { BrandingService, TenantBranding } from './services/catalog/branding.service';
import { prisma } from './prisma';

/**
 * Get tenant information from request headers (set by middleware)
 * Queries database based on domain from middleware
 *
 * Tenant Resolution:
 * - Each tenant has ONE domain (Tenant.domain)
 * - Domain can be anything: subdomain.autolumiku.com, customdomain.com, etc.
 * - All domains must be explicitly configured in Traefik
 */
export async function getTenantFromHeaders(): Promise<{
  id: string | null;
  slug: string | null;
  name: string | null;
  domain: string | null;
}> {
  const headersList = headers();
  const tenantDomain = headersList.get('x-tenant-domain');

  // No domain hint - return null
  if (!tenantDomain) {
    return { id: null, slug: null, name: null, domain: null };
  }

  // Query tenant from database by domain (this runs in server component, not edge)
  const tenant = await prisma.tenant.findFirst({
    where: {
      domain: tenantDomain,
      status: 'active',
    },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
    },
  });

  if (!tenant) {
    return { id: null, slug: null, name: null, domain: null };
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    domain: tenant.domain,
  };
}

/**
 * Get tenant branding from headers
 */
export async function getTenantBranding(): Promise<TenantBranding | null> {
  const { slug } = await getTenantFromHeaders();

  if (!slug) {
    return null;
  }

  return await BrandingService.getBrandingBySlugOrDomain(slug);
}

/**
 * Get full tenant data from headers
 */
export async function getFullTenant() {
  const { id } = await getTenantFromHeaders();

  if (!id) {
    return null;
  }

  return await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      logoUrl: true,
      faviconUrl: true,
      primaryColor: true,
      secondaryColor: true,
      theme: true,
      selectedTheme: true,
      phoneNumber: true,
      phoneNumberSecondary: true,
      whatsappNumber: true,
      email: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      googleMapsUrl: true,
      latitude: true,
      longitude: true,
      businessHours: true,
      socialMedia: true,
    },
  });
}

/**
 * Require tenant or throw 404
 * Use this in pages that must have a tenant context
 */
export async function requireTenant() {
  const tenant = await getTenantFromHeaders();

  if (!tenant.id) {
    throw new Error('Tenant not found');
  }

  return tenant;
}

/**
 * Get allowed CORS origins for a tenant
 */
export async function getTenantCorsOrigins(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      domain: true,
    },
  });

  if (!tenant || !tenant.domain) {
    return [];
  }

  const origins: string[] = [
    `https://${tenant.domain}`,
    `http://${tenant.domain}`,
  ];

  // Add development origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Get the primary URL for a tenant
 */
export async function getTenantUrl(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      domain: true,
      slug: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // If domain is set, use it
  if (tenant.domain) {
    return `https://${tenant.domain}`;
  }

  // Fallback to catalog URL pattern
  return `https://auto.lumiku.com/catalog/${tenant.slug}`;
}
