/**
 * Vehicle Search Command Handlers
 * Epic 3: Story 3.5 - Advanced Vehicle Search via Natural Language
 *
 * Handles complex vehicle search operations with filters
 */

import {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandIntent,
  CommandEntity,
  EntityType,
} from '../types';
import { commandRegistry } from '../command-registry';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Helper Functions
// ============================================================================

function extractEntity<T>(entities: CommandEntity[], type: EntityType): T | undefined {
  return entities.find(e => e.type === type)?.value as T | undefined;
}

function extractAllEntities<T>(entities: CommandEntity[], type: EntityType): T[] {
  return entities.filter(e => e.type === type).map(e => e.value as T);
}

function formatPrice(priceInRupiah: number): string {
  return `Rp ${priceInRupiah.toLocaleString('id-ID')}`;
}

function createSuccessResult(message: string, data?: any, suggestions?: string[]): CommandExecutionResult {
  return {
    success: true,
    message,
    data,
    executionTime: 0,
    suggestions,
  };
}

function createErrorResult(message: string, code: string, suggestions: string[] = []): CommandExecutionResult {
  return {
    success: false,
    message,
    executionTime: 0,
    error: {
      code,
      message,
      recoverySuggestions: suggestions,
      canRetry: true,
    },
  };
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Search vehicles by make/model
 */
async function handleSearchVehicle(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const make = extractEntity<string>(entities, EntityType.VEHICLE_MAKE);
    const model = extractEntity<string>(entities, EntityType.VEHICLE_MODEL);
    const year = extractEntity<number>(entities, EntityType.VEHICLE_YEAR);

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (make) {
      where.make = { contains: make, mode: 'insensitive' };
    }

    if (model) {
      where.model = { contains: model, mode: 'insensitive' };
    }

    if (year) {
      where.year = year;
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const searchTerms = [make, model, year].filter(Boolean).join(' ');

    return createSuccessResult(
      `Ditemukan ${vehicles.length} mobil ${searchTerms}`,
      vehicles,
      [
        'Lihat detail mobil pertama',
        'Filter mobil harga di bawah 200 juta',
        'Urutkan berdasarkan harga',
      ]
    );
  } catch (error: any) {
    console.error('Search vehicle error:', error);
    return createErrorResult(
      'Gagal mencari mobil',
      'SEARCH_ERROR',
      ['Coba cari dengan kriteria yang lebih spesifik']
    );
  }
}

/**
 * Filter vehicles by price range
 */
async function handleFilterVehicles(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const priceMin = extractEntity<number>(entities, EntityType.PRICE_RANGE)?.min;
    const priceMax = extractEntity<number>(entities, EntityType.PRICE_RANGE)?.max;
    const make = extractEntity<string>(entities, EntityType.VEHICLE_MAKE);
    const transmission = extractEntity<string>(entities, EntityType.TRANSMISSION);
    const fuelType = extractEntity<string>(entities, EntityType.FUEL_TYPE);
    const color = extractEntity<string>(entities, EntityType.COLOR);

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (priceMin !== undefined || priceMax !== undefined) {
      where.price = {};
      if (priceMin !== undefined) {
        where.price.gte = priceMin;
      }
      if (priceMax !== undefined) {
        where.price.lte = priceMax;
      }
    }

    if (make) {
      where.make = { contains: make, mode: 'insensitive' };
    }

    if (transmission) {
      where.transmission = transmission;
    }

    if (fuelType) {
      where.fuelType = fuelType;
    }

    if (color) {
      where.color = { contains: color, mode: 'insensitive' };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: {
        price: 'asc',
      },
      take: 50,
    });

    let filterDesc = '';
    if (priceMin && priceMax) {
      filterDesc = `harga ${formatPrice(priceMin)} - ${formatPrice(priceMax)}`;
    } else if (priceMin) {
      filterDesc = `harga di atas ${formatPrice(priceMin)}`;
    } else if (priceMax) {
      filterDesc = `harga di bawah ${formatPrice(priceMax)}`;
    }

    if (make) filterDesc += ` ${make}`;
    if (transmission) filterDesc += ` ${transmission}`;

    return createSuccessResult(
      `Ditemukan ${vehicles.length} mobil dengan ${filterDesc}`,
      vehicles,
      [
        'Lihat detail mobil',
        'Urutkan berdasarkan tahun',
        'Export hasil pencarian',
      ]
    );
  } catch (error: any) {
    console.error('Filter vehicles error:', error);
    return createErrorResult(
      'Gagal memfilter mobil',
      'FILTER_ERROR',
      ['Coba filter dengan kriteria yang berbeda']
    );
  }
}

/**
 * View vehicle details
 */
async function handleViewVehicle(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);
    const plateNumber = extractEntity<string>(entities, EntityType.VEHICLE_PLATE);

    if (!vehicleId && !plateNumber) {
      return createErrorResult(
        'Mohon berikan ID mobil atau nomor plat',
        'MISSING_IDENTIFIER',
        ['Contoh: "Lihat mobil BG1234AB"', 'Atau: "Detail mobil [ID]"']
      );
    }

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (vehicleId) {
      where.id = vehicleId;
    } else if (plateNumber) {
      where.plateNumber = plateNumber;
    }

    const vehicle = await prisma.vehicle.findFirst({
      where,
      include: {
        photos: true,
        category: true,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        'Mobil tidak ditemukan',
        'VEHICLE_NOT_FOUND',
        [
          'Cek kembali ID atau nomor plat',
          'Tampilkan semua mobil',
        ]
      );
    }

    return createSuccessResult(
      `Detail mobil ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      vehicle,
      [
        'Update harga mobil ini',
        'Tandai sebagai terjual',
        'Upload foto tambahan',
      ]
    );
  } catch (error: any) {
    console.error('View vehicle error:', error);
    return createErrorResult(
      'Gagal menampilkan detail mobil',
      'VIEW_ERROR',
      ['Coba lagi dengan ID atau nomor plat yang berbeda']
    );
  }
}

/**
 * Find similar vehicles
 */
async function handleFindSimilar(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon berikan ID mobil referensi',
        'MISSING_VEHICLE_ID',
        ['Contoh: "Cari mobil mirip dengan [ID]"']
      );
    }

    // Get reference vehicle
    const refVehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!refVehicle) {
      return createErrorResult(
        'Mobil referensi tidak ditemukan',
        'VEHICLE_NOT_FOUND',
        ['Cek kembali ID mobil']
      );
    }

    // Find similar vehicles (same make/model, similar price)
    const priceRange = refVehicle.price * 0.2; // ±20% price range

    const similar = await prisma.vehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: { not: vehicleId },
        make: refVehicle.make,
        model: refVehicle.model,
        price: {
          gte: refVehicle.price - priceRange,
          lte: refVehicle.price + priceRange,
        },
      },
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: {
        year: 'desc',
      },
      take: 10,
    });

    return createSuccessResult(
      `Ditemukan ${similar.length} mobil mirip dengan ${refVehicle.make} ${refVehicle.model}`,
      similar,
      [
        'Bandingkan harga mobil-mobil ini',
        'Lihat detail mobil pertama',
      ]
    );
  } catch (error: any) {
    console.error('Find similar error:', error);
    return createErrorResult(
      'Gagal mencari mobil mirip',
      'SEARCH_ERROR',
      ['Coba dengan mobil referensi yang berbeda']
    );
  }
}

// ============================================================================
// Register Commands
// ============================================================================

export function registerVehicleSearchCommands() {
  commandRegistry.registerMultiple([
    {
      intent: CommandIntent.SEARCH_VEHICLE,
      category: 'vehicle',
      description: 'Cari mobil berdasarkan merek, model, atau tahun',
      examples: [
        'Cari mobil Toyota',
        'Cari Avanza 2020',
        'Tampilkan semua Honda',
      ],
      requiredEntities: [],
      handler: handleSearchVehicle,
    },
    {
      intent: CommandIntent.FILTER_VEHICLES,
      category: 'vehicle',
      description: 'Filter mobil berdasarkan kriteria tertentu',
      examples: [
        'Mobil harga di bawah 200 juta',
        'Filter mobil automatic',
        'Cari mobil diesel warna hitam',
      ],
      requiredEntities: [],
      handler: handleFilterVehicles,
    },
    {
      intent: CommandIntent.VIEW_VEHICLE,
      category: 'vehicle',
      description: 'Lihat detail mobil tertentu',
      examples: [
        'Lihat mobil BG1234AB',
        'Detail mobil [ID]',
        'Info lengkap mobil plat BG1234AB',
      ],
      requiredEntities: [EntityType.VEHICLE_ID],
      handler: handleViewVehicle,
    },
    {
      intent: CommandIntent.FIND_SIMILAR,
      category: 'vehicle',
      description: 'Cari mobil yang mirip dengan mobil tertentu',
      examples: [
        'Cari mobil mirip dengan [ID]',
        'Mobil serupa dengan Avanza ini',
        'Tampilkan mobil sejenis',
      ],
      requiredEntities: [EntityType.VEHICLE_ID],
      handler: handleFindSimilar,
    },
  ]);
}
