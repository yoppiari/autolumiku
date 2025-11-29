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
   */
  static async getBrandingBySlugOrDomain(
    slugOrDomain: string
  ): Promise<TenantBranding | null> {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: slugOrDomain },
          { domain: slugOrDomain },
        ],
        status: 'active',
      },
      select: {
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

    return tenant;
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
   */
  static async getTenantIdBySlugOrDomain(
    slugOrDomain: string
  ): Promise<string | null> {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: slugOrDomain },
          { domain: slugOrDomain },
        ],
        status: 'active',
      },
      select: {
        id: true,
      },
    });

    return tenant?.id || null;
  }
}
