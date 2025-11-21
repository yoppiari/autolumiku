/**
 * Pricing Command Handlers
 * Epic 3: Story 3.6 - Pricing Management via Natural Language
 *
 * Handles price updates, bulk pricing, and price analysis
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
 * Update vehicle price
 */
async function handleUpdatePrice(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId, userId } = request;
    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);
    const plateNumber = extractEntity<string>(entities, EntityType.VEHICLE_PLATE);
    const newPrice = extractEntity<number>(entities, EntityType.PRICE);

    if (!vehicleId && !plateNumber) {
      return createErrorResult(
        'Mohon berikan ID mobil atau nomor plat',
        'MISSING_IDENTIFIER',
        ['Contoh: "Update harga mobil BG1234AB menjadi 180 juta"']
      );
    }

    if (!newPrice || newPrice <= 0) {
      return createErrorResult(
        'Mohon berikan harga yang valid',
        'INVALID_PRICE',
        ['Contoh: "Update harga menjadi 180 juta"']
      );
    }

    // Find vehicle
    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (vehicleId) {
      where.id = vehicleId;
    } else if (plateNumber) {
      where.plateNumber = plateNumber;
    }

    const vehicle = await prisma.vehicle.findFirst({ where });

    if (!vehicle) {
      return createErrorResult(
        'Mobil tidak ditemukan',
        'VEHICLE_NOT_FOUND',
        ['Cek kembali ID atau nomor plat', 'Tampilkan semua mobil']
      );
    }

    const oldPrice = vehicle.price;

    // Update price
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        price: newPrice,
        updatedAt: new Date(),
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'UPDATE_VEHICLE_PRICE',
        entityType: 'vehicle',
        entityId: vehicle.id,
        changes: {
          field: 'price',
          oldValue: oldPrice,
          newValue: newPrice,
          reason: 'Updated via natural language command',
        },
      },
    });

    const priceDiff = newPrice - oldPrice;
    const diffText = priceDiff > 0
      ? `naik ${formatPrice(priceDiff)}`
      : `turun ${formatPrice(Math.abs(priceDiff))}`;

    return createSuccessResult(
      `Harga ${vehicle.make} ${vehicle.model} ${diffText} menjadi ${formatPrice(newPrice)}`,
      updated,
      [
        'Lihat detail mobil ini',
        'Update status mobil',
        'Cari mobil dengan harga serupa',
      ]
    );
  } catch (error: any) {
    console.error('Update price error:', error);
    return createErrorResult(
      'Gagal mengupdate harga',
      'UPDATE_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Bulk update prices
 */
async function handleBulkUpdatePrice(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId, userId } = request;
    const make = extractEntity<string>(entities, EntityType.VEHICLE_MAKE);
    const model = extractEntity<string>(entities, EntityType.VEHICLE_MODEL);
    const year = extractEntity<number>(entities, EntityType.VEHICLE_YEAR);
    const adjustment = extractEntity<any>(entities, EntityType.PRICE_ADJUSTMENT);

    if (!adjustment) {
      return createErrorResult(
        'Mohon berikan perubahan harga (persentase atau nominal)',
        'MISSING_ADJUSTMENT',
        [
          'Contoh: "Turunkan harga semua Toyota 10%"',
          'Atau: "Naikkan harga Avanza 5 juta"',
        ]
      );
    }

    // Build filter
    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
      status: 'available', // Only update available vehicles
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

    // Get matching vehicles
    const vehicles = await prisma.vehicle.findMany({ where });

    if (vehicles.length === 0) {
      return createErrorResult(
        'Tidak ada mobil yang cocok dengan kriteria',
        'NO_VEHICLES_FOUND',
        ['Coba dengan kriteria yang berbeda', 'Tampilkan semua mobil']
      );
    }

    // Calculate new prices
    const updates = vehicles.map(v => {
      let newPrice: number;

      if (adjustment.type === 'percentage') {
        const multiplier = 1 + (adjustment.value / 100);
        newPrice = Math.round(v.price * multiplier);
      } else {
        newPrice = v.price + adjustment.value;
      }

      // Ensure price is positive
      newPrice = Math.max(1000000, newPrice); // Min 1 juta

      return {
        id: v.id,
        oldPrice: v.price,
        newPrice,
      };
    });

    // Update all prices in transaction
    await prisma.$transaction(
      updates.map(u =>
        prisma.vehicle.update({
          where: { id: u.id },
          data: { price: u.newPrice },
        })
      )
    );

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BULK_UPDATE_PRICES',
        entityType: 'vehicle',
        entityId: 'bulk',
        changes: {
          adjustment,
          vehicleCount: vehicles.length,
          filters: { make, model, year },
        },
      },
    });

    const adjustmentText = adjustment.type === 'percentage'
      ? `${adjustment.value}%`
      : formatPrice(Math.abs(adjustment.value));

    return createSuccessResult(
      `Berhasil update harga ${vehicles.length} mobil (${adjustment.value > 0 ? 'naik' : 'turun'} ${adjustmentText})`,
      { updatedCount: vehicles.length, updates },
      [
        'Lihat semua mobil yang diupdate',
        'Undo perubahan harga',
        'Export laporan perubahan',
      ]
    );
  } catch (error: any) {
    console.error('Bulk update price error:', error);
    return createErrorResult(
      'Gagal bulk update harga',
      'BULK_UPDATE_ERROR',
      ['Coba dengan kriteria yang lebih spesifik']
    );
  }
}

/**
 * Check vehicle price
 */
async function handleCheckPrice(
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
        ['Contoh: "Cek harga mobil BG1234AB"']
      );
    }

    // Find vehicle
    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (vehicleId) {
      where.id = vehicleId;
    } else if (plateNumber) {
      where.plateNumber = plateNumber;
    }

    const vehicle = await prisma.vehicle.findFirst({ where });

    if (!vehicle) {
      return createErrorResult(
        'Mobil tidak ditemukan',
        'VEHICLE_NOT_FOUND',
        ['Cek kembali ID atau nomor plat']
      );
    }

    // Get price statistics for similar vehicles
    const similar = await prisma.vehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        make: vehicle.make,
        model: vehicle.model,
        year: {
          gte: vehicle.year - 2,
          lte: vehicle.year + 2,
        },
      },
      select: {
        price: true,
      },
    });

    const prices = similar.map(v => v.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const analysis = {
      currentPrice: vehicle.price,
      marketAverage: Math.round(avgPrice),
      marketMin: minPrice,
      marketMax: maxPrice,
      pricePosition: vehicle.price > avgPrice ? 'di atas rata-rata' : 'di bawah rata-rata',
      competitiveCount: similar.length,
    };

    return createSuccessResult(
      `Harga ${vehicle.make} ${vehicle.model} ${vehicle.year}: ${formatPrice(vehicle.price)} (${analysis.pricePosition})`,
      analysis,
      [
        'Update harga mobil ini',
        'Lihat mobil kompetitor',
        'Analisis harga pasar',
      ]
    );
  } catch (error: any) {
    console.error('Check price error:', error);
    return createErrorResult(
      'Gagal mengecek harga',
      'CHECK_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Analyze price trends
 */
async function handlePriceAnalysis(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const make = extractEntity<string>(entities, EntityType.VEHICLE_MAKE);

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (make) {
      where.make = { contains: make, mode: 'insensitive' };
    }

    // Get price distribution
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        price: true,
        make: true,
        model: true,
        year: true,
        status: true,
      },
    });

    if (vehicles.length === 0) {
      return createErrorResult(
        'Tidak ada data harga tersedia',
        'NO_DATA',
        ['Coba dengan kriteria yang berbeda']
      );
    }

    // Calculate statistics
    const prices = vehicles.map(v => v.price);
    const total = prices.reduce((sum, p) => sum + p, 0);
    const avg = total / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Price ranges
    const ranges = {
      'Under 100M': prices.filter(p => p < 100000000).length,
      '100M-200M': prices.filter(p => p >= 100000000 && p < 200000000).length,
      '200M-300M': prices.filter(p => p >= 200000000 && p < 300000000).length,
      'Above 300M': prices.filter(p => p >= 300000000).length,
    };

    const analysis = {
      totalVehicles: vehicles.length,
      averagePrice: Math.round(avg),
      minPrice: min,
      maxPrice: max,
      priceRanges: ranges,
    };

    return createSuccessResult(
      `Analisis harga ${make || 'semua mobil'}: rata-rata ${formatPrice(Math.round(avg))}`,
      analysis,
      [
        'Lihat mobil termurah',
        'Lihat mobil termahal',
        'Export analisis harga',
      ]
    );
  } catch (error: any) {
    console.error('Price analysis error:', error);
    return createErrorResult(
      'Gagal menganalisis harga',
      'ANALYSIS_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

// ============================================================================
// Register Commands
// ============================================================================

export function registerPricingCommands() {
  commandRegistry.registerMultiple([
    {
      intent: CommandIntent.UPDATE_PRICE,
      category: 'pricing',
      description: 'Update harga mobil tertentu',
      examples: [
        'Update harga mobil BG1234AB menjadi 180 juta',
        'Ubah harga Avanza menjadi 175 juta',
        'Set harga mobil [ID] 200 juta',
      ],
      requiredEntities: [EntityType.PRICE],
      handler: handleUpdatePrice,
    },
    {
      intent: CommandIntent.BULK_UPDATE_PRICE,
      category: 'pricing',
      description: 'Update harga beberapa mobil sekaligus',
      examples: [
        'Turunkan harga semua Toyota 10%',
        'Naikkan harga Avanza 2020 sebesar 5 juta',
        'Update harga semua mobil automatic -5%',
      ],
      requiredEntities: [],
      handler: handleBulkUpdatePrice,
    },
    {
      intent: CommandIntent.CHECK_PRICE,
      category: 'pricing',
      description: 'Cek harga mobil dan analisis market',
      examples: [
        'Cek harga mobil BG1234AB',
        'Berapa harga Avanza ini?',
        'Info harga mobil [ID]',
      ],
      requiredEntities: [],
      handler: handleCheckPrice,
    },
    {
      intent: CommandIntent.ANALYZE_PRICING,
      category: 'pricing',
      description: 'Analisis trend harga mobil',
      examples: [
        'Analisis harga Toyota',
        'Lihat distribusi harga mobil',
        'Statistik harga inventory',
      ],
      requiredEntities: [],
      handler: handlePriceAnalysis,
    },
  ]);
}
