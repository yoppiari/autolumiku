/**
 * Tenant Helper Functions
 * Utilities for working with tenant context in Next.js pages
 */

import { headers } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { BrandingService, TenantBranding } from './services/catalog/branding.service';

const prisma = new PrismaClient();

/**
 * Get tenant information from request headers (set by middleware)
 * Queries database based on slug hint from middleware
 */
export async function getTenantFromHeaders(): Promise<{
  id: string | null;
  slug: string | null;
  name: string | null;
}> {
  const headersList = headers();
  const slugHint = headersList.get('x-tenant-slug-hint');

  if (!slugHint) {
    return { id: null, slug: null, name: null };
  }

  // Query tenant from database (this runs in server component, not edge)
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: slugHint,
      status: 'active',
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) {
    return { id: null, slug: null, name: null };
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
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
