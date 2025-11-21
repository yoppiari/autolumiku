/**
 * Catalog Engine Service
 * Epic 5: Story 5.1, 5.4, 5.6 - Public Catalog Generation & Performance
 *
 * Generates and serves customer-facing vehicle catalogs
 */

import { prisma } from '@/lib/prisma';
import { Vehicle, VehiclePhoto, Prisma } from '@prisma/client';

export interface CatalogFilters {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  transmission?: string;
  fuelType?: string;
  search?: string;
  categories?: string[];
  tags?: string[];
}

export interface CatalogOptions {
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'year' | 'mileage' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface VehicleWithPhotos extends Vehicle {
  photos: VehiclePhoto[];
}

export interface CatalogResult {
  vehicles: VehicleWithPhotos[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  filters: {
    makes: string[];
    models: string[];
    years: number[];
    priceRange: { min: number; max: number };
  };
}

export class CatalogEngineService {
  /**
   * Get public vehicle catalog for tenant
   */
  async getCatalog(
    tenantId: string,
    filters: CatalogFilters = {},
    options: CatalogOptions = {}
  ): Promise<CatalogResult> {
    const page = options.page || 1;
    const limit = options.limit || 12;
    const skip = (page - 1) * limit;

    // Build where clause - only show AVAILABLE vehicles
    const where = this.buildWhereClause(tenantId, filters);

    // Build order by
    const orderBy = this.buildOrderBy(options.sortBy, options.sortOrder);

    // Execute query with photos
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          photos: {
            orderBy: [{ isMainPhoto: 'desc' }, { displayOrder: 'asc' }],
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Get available filters
    const filterOptions = await this.getAvailableFilters(tenantId);

    return {
      vehicles: vehicles as VehicleWithPhotos[],
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      filters: filterOptions,
    };
  }

  /**
   * Get single vehicle for public view
   */
  async getVehicle(vehicleId: string, tenantId: string): Promise<VehicleWithPhotos | null> {
    return prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        status: 'AVAILABLE', // Only show available vehicles
      },
      include: {
        photos: {
          orderBy: [{ isMainPhoto: 'desc' }, { displayOrder: 'asc' }],
        },
      },
    }) as Promise<VehicleWithPhotos | null>;
  }

  /**
   * Get featured vehicles
   */
  async getFeaturedVehicles(tenantId: string, limit: number = 6): Promise<VehicleWithPhotos[]> {
    return prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        isFeatured: true,
      },
      take: limit,
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        photos: {
          where: { isMainPhoto: true },
          take: 1,
        },
      },
    }) as Promise<VehicleWithPhotos[]>;
  }

  /**
   * Get latest vehicles
   */
  async getLatestVehicles(tenantId: string, limit: number = 12): Promise<VehicleWithPhotos[]> {
    return prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
      },
      take: limit,
      orderBy: {
        publishedAt: 'desc',
      },
      include: {
        photos: {
          where: { isMainPhoto: true },
          take: 1,
        },
      },
    }) as Promise<VehicleWithPhotos[]>;
  }

  /**
   * Get similar vehicles (same make/model)
   */
  async getSimilarVehicles(
    vehicleId: string,
    tenantId: string,
    limit: number = 4
  ): Promise<VehicleWithPhotos[]> {
    // Get the reference vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) return [];

    // Find similar vehicles
    return prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        id: { not: vehicleId },
        make: vehicle.make,
        // Optional: same model or similar price range
        OR: [
          { model: vehicle.model },
          {
            price: {
              gte: vehicle.price * 0.8,
              lte: vehicle.price * 1.2,
            },
          },
        ],
      },
      take: limit,
      include: {
        photos: {
          where: { isMainPhoto: true },
          take: 1,
        },
      },
    }) as Promise<VehicleWithPhotos[]>;
  }

  /**
   * Quick search for autocomplete
   */
  async quickSearch(tenantId: string, query: string, limit: number = 5): Promise<VehicleWithPhotos[]> {
    return prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        OR: [
          { make: { contains: query, mode: 'insensitive' } },
          { model: { contains: query, mode: 'insensitive' } },
          { variant: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: {
        photos: {
          where: { isMainPhoto: true },
          take: 1,
        },
      },
    }) as Promise<VehicleWithPhotos[]>;
  }

  /**
   * Get catalog statistics
   */
  async getCatalogStats(tenantId: string): Promise<{
    totalVehicles: number;
    makes: number;
    priceRange: { min: number; max: number; avg: number };
  }> {
    const [total, makes, priceStats] = await Promise.all([
      prisma.vehicle.count({
        where: {
          tenantId,
          status: 'AVAILABLE',
        },
      }),
      prisma.vehicle.groupBy({
        by: ['make'],
        where: {
          tenantId,
          status: 'AVAILABLE',
        },
      }),
      prisma.vehicle.aggregate({
        where: {
          tenantId,
          status: 'AVAILABLE',
        },
        _min: { price: true },
        _max: { price: true },
        _avg: { price: true },
      }),
    ]);

    return {
      totalVehicles: total,
      makes: makes.length,
      priceRange: {
        min: priceStats._min.price || 0,
        max: priceStats._max.price || 0,
        avg: Math.round(priceStats._avg.price || 0),
      },
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Build where clause for catalog
   */
  private buildWhereClause(tenantId: string, filters: CatalogFilters): Prisma.VehicleWhereInput {
    const where: Prisma.VehicleWhereInput = {
      tenantId,
      status: 'AVAILABLE', // Only show available vehicles
    };

    // Text search
    if (filters.search) {
      where.OR = [
        { make: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
        { variant: { contains: filters.search, mode: 'insensitive' } },
        { descriptionId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (filters.make) where.make = { contains: filters.make, mode: 'insensitive' };
    if (filters.model) where.model = { contains: filters.model, mode: 'insensitive' };
    if (filters.transmission) where.transmissionType = filters.transmission;
    if (filters.fuelType) where.fuelType = filters.fuelType;

    // Range filters
    if (filters.yearMin || filters.yearMax) {
      where.year = {};
      if (filters.yearMin) where.year.gte = filters.yearMin;
      if (filters.yearMax) where.year.lte = filters.yearMax;
    }

    if (filters.priceMin || filters.priceMax) {
      where.price = {};
      if (filters.priceMin) where.price.gte = filters.priceMin;
      if (filters.priceMax) where.price.lte = filters.priceMax;
    }

    // Array filters
    if (filters.categories && filters.categories.length > 0) {
      where.categories = { hasSome: filters.categories };
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    return where;
  }

  /**
   * Build order by clause
   */
  private buildOrderBy(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Prisma.VehicleOrderByWithRelationInput {
    const validFields = ['price', 'year', 'mileage', 'createdAt', 'publishedAt'];

    if (sortBy && validFields.includes(sortBy)) {
      return { [sortBy]: sortOrder };
    }

    // Default: newest first
    return { publishedAt: 'desc' };
  }

  /**
   * Get available filter options
   */
  private async getAvailableFilters(tenantId: string): Promise<{
    makes: string[];
    models: string[];
    years: number[];
    priceRange: { min: number; max: number };
  }> {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
      },
      select: {
        make: true,
        model: true,
        year: true,
        price: true,
      },
    });

    const makes = [...new Set(vehicles.map((v) => v.make))].sort();
    const models = [...new Set(vehicles.map((v) => v.model))].sort();
    const years = [...new Set(vehicles.map((v) => v.year))].sort((a, b) => b - a);
    const prices = vehicles.map((v) => v.price);

    return {
      makes,
      models,
      years,
      priceRange: {
        min: Math.min(...prices, 0),
        max: Math.max(...prices, 0),
      },
    };
  }
}

export const catalogEngineService = new CatalogEngineService();
