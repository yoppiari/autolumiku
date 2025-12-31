/**
 * Catalog Engine Service
 * Main service for public catalog functionality
 */

import { VehicleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CatalogVehicle {
  id: string;
  displayId: string | null;
  make: string;
  model: string;
  year: number;
  variant: string | null;
  price: number;
  mileage: number | null;
  transmissionType: string | null;
  fuelType: string | null;
  engineCapacity: string | null;
  color: string | null;
  descriptionId: string | null;
  status: VehicleStatus;
  photos: {
    id: string;
    originalUrl: string;
    thumbnailUrl: string;
    displayOrder: number;
  }[];
  createdAt: Date;
  // Sales info for WhatsApp contact
  salesPhone: string | null;
  salesName: string | null;
}

export interface CatalogFilters {
  search?: string;
  make?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  transmissionType?: string;
  fuelType?: string;
  sortBy?: 'price-asc' | 'price-desc' | 'year-desc' | 'date-desc';
  page?: number;
  limit?: number;
}

export interface CatalogResult {
  vehicles: CatalogVehicle[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    makes: string[];
    years: number[];
    transmissionTypes: string[];
    fuelTypes: string[];
    priceRange: { min: number; max: number };
  };
}

export class CatalogEngineService {
  /**
   * Get vehicles for catalog with filters and pagination
   */
  static async getVehicles(
    tenantId: string,
    filters: CatalogFilters = {}
  ): Promise<CatalogResult> {
    const {
      search,
      make,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      transmissionType,
      fuelType,
      sortBy = 'date-desc',
      page = 1,
      limit = 12,
    } = filters;

    // Build where clause - show both AVAILABLE and SOLD vehicles
    const where: any = {
      tenantId,
      status: { in: ['AVAILABLE', 'SOLD'] }, // Show available and sold vehicles
    };

    // Search filter
    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { variant: { contains: search, mode: 'insensitive' } },
        { descriptionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Make filter
    if (make) {
      where.make = make;
    }

    // Price range filter (prices are in raw IDR)
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = BigInt(minPrice);
      }
      if (maxPrice !== undefined) {
        where.price.lte = BigInt(maxPrice);
      }
    }

    // Year range filter
    if (minYear !== undefined || maxYear !== undefined) {
      where.year = {};
      if (minYear !== undefined) {
        where.year.gte = minYear;
      }
      if (maxYear !== undefined) {
        where.year.lte = maxYear;
      }
    }

    // Transmission type filter
    if (transmissionType) {
      where.transmissionType = transmissionType;
    }

    // Fuel type filter
    if (fuelType) {
      where.fuelType = fuelType;
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' }; // Default sort
    switch (sortBy) {
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      case 'year-desc':
        orderBy = { year: 'desc' };
        break;
      case 'date-desc':
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get total count
    const total = await prisma.vehicle.count({ where });

    // Get paginated vehicles
    const skip = (page - 1) * limit;
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        variant: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        engineCapacity: true,
        color: true,
        descriptionId: true,
        status: true,
        createdAt: true,
        photos: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            originalUrl: true,
            thumbnailUrl: true,
            displayOrder: true,
          },
        },
        // Include creator (sales person who uploaded)
        creator: {
          select: {
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get filter options (for filter UI)
    const allVehicles = await prisma.vehicle.findMany({
      where: { tenantId, status: { in: ['AVAILABLE', 'SOLD'] } },
      select: {
        make: true,
        year: true,
        transmissionType: true,
        fuelType: true,
        price: true,
      },
    });

    const makes = Array.from(new Set(allVehicles.map((v) => v.make))).sort();
    const years = Array.from(new Set(allVehicles.map((v) => v.year))).sort(
      (a, b) => b - a
    );
    const transmissionTypes = Array.from(new Set(
        allVehicles
          .map((v) => v.transmissionType)
          .filter((t): t is string => t !== null)
      )).sort();
    const fuelTypes = Array.from(new Set(
        allVehicles.map((v) => v.fuelType).filter((f): f is string => f !== null)
      )).sort();

    const prices = allVehicles.map((v) => Number(v.price) / 100000000);
    const priceRange = {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };

    // Convert BigInt to number for JSON serialization
    // Include sales phone from creator (uploader)
    const serializedVehicles = vehicles.map((v) => ({
      ...v,
      price: Number(v.price),
      salesPhone: v.creator?.phone || null,
      salesName: v.creator ? `${v.creator.firstName} ${v.creator.lastName}`.trim() : null,
      creator: undefined, // Don't expose full creator object
    }));

    return {
      vehicles: serializedVehicles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filters: {
        makes,
        years,
        transmissionTypes,
        fuelTypes,
        priceRange,
      },
    };
  }

  /**
   * Get single vehicle by ID for detail page
   */
  static async getVehicleById(
    vehicleId: string,
    tenantId: string
  ): Promise<CatalogVehicle | null> {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        status: { in: ['AVAILABLE', 'SOLD'] },
      },
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        variant: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        engineCapacity: true,
        color: true,
        descriptionId: true,
        status: true,
        createdAt: true,
        photos: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            originalUrl: true,
            thumbnailUrl: true,
            displayOrder: true,
          },
        },
        // Include creator (sales person who uploaded)
        creator: {
          select: {
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!vehicle) return null;

    return {
      ...vehicle,
      price: Number(vehicle.price),
      salesPhone: vehicle.creator?.phone || null,
      salesName: vehicle.creator ? `${vehicle.creator.firstName} ${vehicle.creator.lastName}`.trim() : null,
    };
  }

  /**
   * Get featured vehicles (for homepage)
   */
  static async getFeaturedVehicles(
    tenantId: string,
    limit: number = 6
  ): Promise<CatalogVehicle[]> {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: { in: ['AVAILABLE', 'SOLD'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        variant: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        engineCapacity: true,
        color: true,
        descriptionId: true,
        status: true,
        createdAt: true,
        photos: {
          orderBy: { displayOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            originalUrl: true,
            thumbnailUrl: true,
            displayOrder: true,
          },
        },
        // Include creator (sales person who uploaded)
        creator: {
          select: {
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return vehicles.map((v) => ({
      ...v,
      price: Number(v.price),
      salesPhone: v.creator?.phone || null,
      salesName: v.creator ? `${v.creator.firstName} ${v.creator.lastName}`.trim() : null,
    }));
  }
}
