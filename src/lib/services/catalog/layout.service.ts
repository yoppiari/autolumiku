/**
 * Catalog Layout Service
 * Epic 5: Story 5.7 - Layout Customization
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CatalogLayoutConfig {
  id?: string;
  tenantId: string;
  layoutType: 'GRID' | 'LIST' | 'FEATURED';
  heroEnabled: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  featuredVehicleIds: string[];
  sectionOrder: string[];
  navigationMenu?: any;
  vehiclesPerPage: number;
  showPriceRange: boolean;
  showVehicleCount: boolean;
}

export class LayoutService {
  /**
   * Get layout configuration for a tenant
   */
  static async getLayout(tenantId: string): Promise<CatalogLayoutConfig | null> {
    try {
      const layout = await prisma.catalogLayout.findUnique({
        where: { tenantId },
      });

      if (!layout) {
        return null;
      }

      return {
        id: layout.id,
        tenantId: layout.tenantId,
        layoutType: layout.layoutType as 'GRID' | 'LIST' | 'FEATURED',
        heroEnabled: layout.heroEnabled,
        heroTitle: layout.heroTitle || undefined,
        heroSubtitle: layout.heroSubtitle || undefined,
        heroImageUrl: layout.heroImageUrl || undefined,
        featuredVehicleIds: layout.featuredVehicleIds,
        sectionOrder: layout.sectionOrder,
        navigationMenu: layout.navigationMenu,
        vehiclesPerPage: layout.vehiclesPerPage,
        showPriceRange: layout.showPriceRange,
        showVehicleCount: layout.showVehicleCount,
      };
    } catch (error) {
      console.error('Failed to get layout:', error);
      throw error;
    }
  }

  /**
   * Create or update layout configuration
   */
  static async upsertLayout(config: CatalogLayoutConfig): Promise<CatalogLayoutConfig> {
    try {
      const layout = await prisma.catalogLayout.upsert({
        where: { tenantId: config.tenantId },
        create: {
          tenantId: config.tenantId,
          layoutType: config.layoutType,
          heroEnabled: config.heroEnabled,
          heroTitle: config.heroTitle,
          heroSubtitle: config.heroSubtitle,
          heroImageUrl: config.heroImageUrl,
          featuredVehicleIds: config.featuredVehicleIds,
          sectionOrder: config.sectionOrder,
          navigationMenu: config.navigationMenu,
          vehiclesPerPage: config.vehiclesPerPage,
          showPriceRange: config.showPriceRange,
          showVehicleCount: config.showVehicleCount,
        },
        update: {
          layoutType: config.layoutType,
          heroEnabled: config.heroEnabled,
          heroTitle: config.heroTitle,
          heroSubtitle: config.heroSubtitle,
          heroImageUrl: config.heroImageUrl,
          featuredVehicleIds: config.featuredVehicleIds,
          sectionOrder: config.sectionOrder,
          navigationMenu: config.navigationMenu,
          vehiclesPerPage: config.vehiclesPerPage,
          showPriceRange: config.showPriceRange,
          showVehicleCount: config.showVehicleCount,
        },
      });

      return {
        id: layout.id,
        tenantId: layout.tenantId,
        layoutType: layout.layoutType as 'GRID' | 'LIST' | 'FEATURED',
        heroEnabled: layout.heroEnabled,
        heroTitle: layout.heroTitle || undefined,
        heroSubtitle: layout.heroSubtitle || undefined,
        heroImageUrl: layout.heroImageUrl || undefined,
        featuredVehicleIds: layout.featuredVehicleIds,
        sectionOrder: layout.sectionOrder,
        navigationMenu: layout.navigationMenu,
        vehiclesPerPage: layout.vehiclesPerPage,
        showPriceRange: layout.showPriceRange,
        showVehicleCount: layout.showVehicleCount,
      };
    } catch (error) {
      console.error('Failed to upsert layout:', error);
      throw error;
    }
  }

  /**
   * Get default layout configuration
   */
  static getDefaultLayout(tenantId: string): CatalogLayoutConfig {
    return {
      tenantId,
      layoutType: 'GRID',
      heroEnabled: true,
      heroTitle: 'Temukan Mobil Impian Anda',
      heroSubtitle: 'Pilihan terbaik dengan harga kompetitif',
      featuredVehicleIds: [],
      sectionOrder: ['hero', 'featured', 'filters', 'vehicles'],
      vehiclesPerPage: 12,
      showPriceRange: true,
      showVehicleCount: true,
    };
  }

  /**
   * Delete layout configuration
   */
  static async deleteLayout(tenantId: string): Promise<void> {
    try {
      await prisma.catalogLayout.delete({
        where: { tenantId },
      });
    } catch (error) {
      console.error('Failed to delete layout:', error);
      throw error;
    }
  }
}
