/**
 * Branding Service
 * Epic 5: Story 5.2, 5.7, 5.8, 5.9 - Tenant Branding & Theming
 *
 * Manages tenant branding, themes, and business information
 */

import { prisma } from '@/lib/prisma';
import { TenantBranding, WebsiteTheme } from '@prisma/client';

export interface BrandingConfig {
  businessName: string;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  city?: string;
  province?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface ThemeConfig {
  name: string;
  slug: string;
  layoutType?: string;
  featuredLayout?: string;
  homepageSections?: string[];
  vehiclesPerPage?: number;
}

export class BrandingService {
  /**
   * Get or create branding for tenant
   */
  async getOrCreateBranding(tenantId: string, subdomain: string): Promise<TenantBranding> {
    let branding = await prisma.tenantBranding.findUnique({
      where: { tenantId },
    });

    if (!branding) {
      // Create default branding
      branding = await prisma.tenantBranding.create({
        data: {
          tenantId,
          businessName: 'My Showroom',
          subdomain,
          primaryColor: '#2563eb',
          secondaryColor: '#7c3aed',
          accentColor: '#f59e0b',
          fontFamily: 'Inter',
        },
      });
    }

    return branding;
  }

  /**
   * Update branding configuration
   */
  async updateBranding(tenantId: string, config: Partial<BrandingConfig>): Promise<TenantBranding> {
    return prisma.tenantBranding.update({
      where: { tenantId },
      data: config,
    });
  }

  /**
   * Get branding by subdomain
   */
  async getBrandingBySubdomain(subdomain: string): Promise<TenantBranding | null> {
    return prisma.tenantBranding.findUnique({
      where: { subdomain },
    });
  }

  /**
   * Get branding by custom domain
   */
  async getBrandingByCustomDomain(domain: string): Promise<TenantBranding | null> {
    return prisma.tenantBranding.findUnique({
      where: { customDomain: domain },
    });
  }

  /**
   * Set custom domain
   */
  async setCustomDomain(tenantId: string, domain: string): Promise<TenantBranding> {
    return prisma.tenantBranding.update({
      where: { tenantId },
      data: { customDomain: domain },
    });
  }

  /**
   * Get active theme for tenant
   */
  async getActiveTheme(tenantId: string): Promise<WebsiteTheme | null> {
    return prisma.websiteTheme.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
    });
  }

  /**
   * Get all themes for tenant
   */
  async getAllThemes(tenantId: string): Promise<WebsiteTheme[]> {
    return prisma.websiteTheme.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create new theme
   */
  async createTheme(tenantId: string, config: ThemeConfig): Promise<WebsiteTheme> {
    return prisma.websiteTheme.create({
      data: {
        tenantId,
        ...config,
        menuItems: { items: [] }, // Default empty menu
      },
    });
  }

  /**
   * Update theme
   */
  async updateTheme(themeId: string, config: Partial<ThemeConfig>): Promise<WebsiteTheme> {
    return prisma.websiteTheme.update({
      where: { id: themeId },
      data: config,
    });
  }

  /**
   * Activate theme (deactivate others)
   */
  async activateTheme(themeId: string, tenantId: string): Promise<WebsiteTheme> {
    // Deactivate all themes for this tenant
    await prisma.websiteTheme.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    // Activate the selected theme
    return prisma.websiteTheme.update({
      where: { id: themeId },
      data: { isActive: true },
    });
  }

  /**
   * Create default themes for new tenant
   */
  async createDefaultThemes(tenantId: string): Promise<WebsiteTheme[]> {
    const defaultThemes = [
      {
        name: 'Modern',
        slug: 'modern',
        layoutType: 'grid',
        featuredLayout: 'hero',
        homepageSections: ['hero', 'featured', 'latest', 'categories'],
        isActive: true,
        isDefault: true,
      },
      {
        name: 'Classic',
        slug: 'classic',
        layoutType: 'list',
        featuredLayout: 'carousel',
        homepageSections: ['featured', 'categories', 'latest'],
        isActive: false,
        isDefault: false,
      },
      {
        name: 'Minimalist',
        slug: 'minimalist',
        layoutType: 'masonry',
        featuredLayout: 'grid',
        homepageSections: ['latest', 'categories'],
        isActive: false,
        isDefault: false,
      },
    ];

    const themes = [];
    for (const themeData of defaultThemes) {
      const theme = await prisma.websiteTheme.create({
        data: {
          tenantId,
          ...themeData,
          menuItems: {
            items: [
              { label: 'Home', url: '/' },
              { label: 'Vehicles', url: '/vehicles' },
              { label: 'Contact', url: '/contact' },
            ],
          },
        },
      });
      themes.push(theme);
    }

    return themes;
  }

  /**
   * Get complete branding + theme config
   */
  async getCompleteBrandingConfig(
    tenantId: string
  ): Promise<{ branding: TenantBranding; theme: WebsiteTheme | null }> {
    const [branding, theme] = await Promise.all([
      this.getOrCreateBranding(tenantId, `tenant-${tenantId.slice(0, 8)}`),
      this.getActiveTheme(tenantId),
    ]);

    return { branding, theme };
  }

  /**
   * Generate CSS variables from branding
   */
  generateCSSVariables(branding: TenantBranding): string {
    return `
      :root {
        --primary-color: ${branding.primaryColor};
        --secondary-color: ${branding.secondaryColor};
        --accent-color: ${branding.accentColor};
        --font-family: ${branding.fontFamily}, sans-serif;
      }
    `;
  }

  /**
   * Validate subdomain availability
   */
  async isSubdomainAvailable(subdomain: string, excludeTenantId?: string): Promise<boolean> {
    const existing = await prisma.tenantBranding.findUnique({
      where: { subdomain },
    });

    if (!existing) return true;
    if (excludeTenantId && existing.tenantId === excludeTenantId) return true;

    return false;
  }

  /**
   * Validate custom domain availability
   */
  async isCustomDomainAvailable(domain: string, excludeTenantId?: string): Promise<boolean> {
    const existing = await prisma.tenantBranding.findUnique({
      where: { customDomain: domain },
    });

    if (!existing) return true;
    if (excludeTenantId && existing.tenantId === excludeTenantId) return true;

    return false;
  }
}

export const brandingService = new BrandingService();
