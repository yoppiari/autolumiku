/**
 * Advanced Search Service
 * Epic 4: Story 4.7 - Inventory Search and Filtering System
 *
 * Provides advanced search and filtering capabilities for vehicle inventory
 */

import { prisma } from '@/lib/prisma';
import { Vehicle, Prisma } from '@prisma/client';

export interface SearchFilters {
  // Text search
  query?: string; // Search in make, model, variant

  // Exact matches
  make?: string;
  model?: string;
  year?: number;
  status?: string;
  transmission?: string;
  fuelType?: string;
  color?: string;

  // Range filters
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMin?: number;
  mileageMax?: number;

  // Array filters
  tags?: string[];
  categories?: string[];

  // Boolean filters
  isFeatured?: boolean;
  hasPhotos?: boolean;

  // Date filters
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includePhotos?: boolean;
  includeHistory?: boolean;
}

export interface SearchResult {
  vehicles: Vehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  aggregations?: {
    byMake: Record<string, number>;
    byStatus: Record<string, number>;
    byYear: Record<number, number>;
    priceRange: { min: number; max: number; avg: number };
  };
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  tenantId: string;
  userId: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AdvancedSearchService {
  /**
   * Search vehicles with advanced filters
   */
  async search(
    tenantId: string,
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = this.buildWhereClause(tenantId, filters);

    // Build order by
    const orderBy = this.buildOrderBy(options.sortBy, options.sortOrder);

    // Build include
    const include: any = {};
    if (options.includePhotos) {
      include.photos = {
        where: { isMainPhoto: true },
        take: 1,
      };
    }
    if (options.includeHistory) {
      include.history = {
        take: 5,
        orderBy: { version: 'desc' },
      };
    }

    // Execute query
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: Object.keys(include).length > 0 ? include : undefined,
      }),
      prisma.vehicle.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Calculate aggregations if needed
    let aggregations;
    if (filters.query || Object.keys(filters).length > 1) {
      aggregations = await this.calculateAggregations(tenantId, filters);
    }

    return {
      vehicles,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      aggregations,
    };
  }

  /**
   * Quick search (simpler, faster)
   */
  async quickSearch(
    tenantId: string,
    query: string,
    limit: number = 10
  ): Promise<Vehicle[]> {
    return prisma.vehicle.findMany({
      where: {
        tenantId,
        OR: [
          { make: { contains: query, mode: 'insensitive' } },
          { model: { contains: query, mode: 'insensitive' } },
          { variant: { contains: query, mode: 'insensitive' } },
          { licensePlate: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Get filter suggestions based on current results
   */
  async getFilterSuggestions(
    tenantId: string,
    currentFilters: SearchFilters
  ): Promise<{
    makes: string[];
    models: string[];
    years: number[];
    tags: string[];
    categories: string[];
  }> {
    const where = this.buildWhereClause(tenantId, currentFilters);

    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        make: true,
        model: true,
        year: true,
        tags: true,
        categories: true,
      },
    });

    const makes = new Set<string>();
    const models = new Set<string>();
    const years = new Set<number>();
    const tags = new Set<string>();
    const categories = new Set<string>();

    vehicles.forEach((v) => {
      makes.add(v.make);
      models.add(v.model);
      years.add(v.year);
      v.tags?.forEach((t) => tags.add(t));
      v.categories?.forEach((c) => categories.add(c));
    });

    return {
      makes: Array.from(makes).sort(),
      models: Array.from(models).sort(),
      years: Array.from(years).sort((a, b) => b - a),
      tags: Array.from(tags).sort(),
      categories: Array.from(categories).sort(),
    };
  }

  /**
   * Save search for reuse
   */
  async saveSearch(
    name: string,
    filters: SearchFilters,
    tenantId: string,
    userId: string,
    isDefault: boolean = false
  ): Promise<SavedSearch> {
    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.$executeRaw`
        UPDATE saved_searches
        SET "isDefault" = false
        WHERE "tenantId" = ${tenantId} AND "userId" = ${userId}
      `;
    }

    const saved = await prisma.savedSearch.create({
      data: {
        name,
        filters: filters as any,
        tenantId,
        userId,
        isDefault,
      },
    });

    return saved as any;
  }

  /**
   * Get saved searches
   */
  async getSavedSearches(tenantId: string, userId: string): Promise<SavedSearch[]> {
    return prisma.savedSearch.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }) as any;
  }

  /**
   * Delete saved search
   */
  async deleteSavedSearch(id: string, tenantId: string, userId: string): Promise<boolean> {
    try {
      await prisma.savedSearch.delete({
        where: {
          id,
          tenantId,
          userId,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(tenantId: string, filters: SearchFilters): Prisma.VehicleWhereInput {
    const where: Prisma.VehicleWhereInput = {
      tenantId,
    };

    // Text search
    if (filters.query) {
      where.OR = [
        { make: { contains: filters.query, mode: 'insensitive' } },
        { model: { contains: filters.query, mode: 'insensitive' } },
        { variant: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    // Exact matches
    if (filters.make) where.make = { contains: filters.make, mode: 'insensitive' };
    if (filters.model) where.model = { contains: filters.model, mode: 'insensitive' };
    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status as any;
    if (filters.transmission) where.transmissionType = filters.transmission;
    if (filters.fuelType) where.fuelType = filters.fuelType;
    if (filters.color) where.color = { contains: filters.color, mode: 'insensitive' };

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

    if (filters.mileageMin || filters.mileageMax) {
      where.mileage = {};
      if (filters.mileageMin) where.mileage.gte = filters.mileageMin;
      if (filters.mileageMax) where.mileage.lte = filters.mileageMax;
    }

    // Array filters
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.categories && filters.categories.length > 0) {
      where.categories = { hasSome: filters.categories };
    }

    // Boolean filters
    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters.hasPhotos) {
      where.photos = { some: {} };
    }

    // Date filters
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      where.updatedAt = {};
      if (filters.updatedAfter) where.updatedAt.gte = filters.updatedAfter;
      if (filters.updatedBefore) where.updatedAt.lte = filters.updatedBefore;
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
    const validSortFields = ['createdAt', 'updatedAt', 'price', 'year', 'mileage', 'make', 'model'];

    if (sortBy && validSortFields.includes(sortBy)) {
      return { [sortBy]: sortOrder };
    }

    // Default: sort by updated date
    return { updatedAt: 'desc' };
  }

  /**
   * Calculate aggregations for search results
   */
  private async calculateAggregations(
    tenantId: string,
    filters: SearchFilters
  ): Promise<{
    byMake: Record<string, number>;
    byStatus: Record<string, number>;
    byYear: Record<number, number>;
    priceRange: { min: number; max: number; avg: number };
  }> {
    const where = this.buildWhereClause(tenantId, filters);

    const [byMake, byStatus, byYear, priceStats] = await Promise.all([
      prisma.vehicle.groupBy({
        by: ['make'],
        where,
        _count: { id: true },
      }),
      prisma.vehicle.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.vehicle.groupBy({
        by: ['year'],
        where,
        _count: { id: true },
      }),
      prisma.vehicle.aggregate({
        where,
        _min: { price: true },
        _max: { price: true },
        _avg: { price: true },
      }),
    ]);

    return {
      byMake: Object.fromEntries(byMake.map((item) => [item.make, item._count.id])),
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count.id])),
      byYear: Object.fromEntries(byYear.map((item) => [item.year, item._count.id])),
      priceRange: {
        min: priceStats._min.price || 0,
        max: priceStats._max.price || 0,
        avg: priceStats._avg.price || 0,
      },
    };
  }
}

export const advancedSearchService = new AdvancedSearchService();
