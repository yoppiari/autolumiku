/**
 * Branding Service
 * Handles tenant branding and theme application
 */

import { prisma } from '@/lib/prisma';

export interface TenantBranding {
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  domain: string | null;
}

export class BrandingService {
  /**
   * Get tenant branding by slug or domain
   * Supports fallback lookup: if slug ends with -id (e.g., primamobil-id),
   * also tries without the suffix (primamobil)
   */
  static async getBrandingBySlugOrDomain(
    slugOrDomain: string
  ): Promise<(TenantBranding & { tenantId: string }) | null> {
    // Build OR conditions with fallback for -id suffix
    const orConditions: any[] = [
      { slug: slugOrDomain },
      { domain: slugOrDomain },
    ];

    // Fallback: if slug ends with -id, also try without it
    if (slugOrDomain.endsWith('-id')) {
      const slugWithoutId = slugOrDomain.replace(/-id$/, '');
      orConditions.push({ slug: slugWithoutId });
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: orConditions,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        theme: true,
        domain: true,
      },
    });

    if (!tenant) return null;

    return {
      ...tenant,
      tenantId: tenant.id,
    };
  }

  /**
   * Get CSS variables for tenant theme
   */
  static getCSSVariables(branding: TenantBranding): string {
    return `
      :root {
        --primary-color: ${branding.primaryColor};
        --secondary-color: ${branding.secondaryColor};
        --theme-mode: ${branding.theme};
      }
    `;
  }

  /**
   * Get tenant ID by slug or domain
   * Supports fallback lookup: if slug ends with -id (e.g., primamobil-id),
   * also tries without the suffix (primamobil)
   */
  static async getTenantIdBySlugOrDomain(
    slugOrDomain: string
  ): Promise<string | null> {
    // Build OR conditions with fallback for -id suffix
    const orConditions: any[] = [
      { slug: slugOrDomain },
      { domain: slugOrDomain },
    ];

    // Fallback: if slug ends with -id, also try without it
    if (slugOrDomain.endsWith('-id')) {
      const slugWithoutId = slugOrDomain.replace(/-id$/, '');
      orConditions.push({ slug: slugWithoutId });
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: orConditions,
        status: 'active',
      },
      select: {
        id: true,
      },
    });

    return tenant?.id || null;
  }
}
