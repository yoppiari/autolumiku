/**
 * Inventory Command Handlers
 * Epic 3: Story 3.6 - Natural Language Inventory Management
 *
 * Handles all vehicle inventory operations via natural language
 */

import {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandIntent,
  CommandEntity,
  EntityType,
  VehicleSearchCriteria,
} from '../types';
import { commandRegistry } from '../command-registry';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Helper Functions
// ============================================================================

function extractEntity<T>(entities: CommandEntity[], type: EntityType): T | undefined {
  return entities.find(e => e.type === type)?.value as T | undefined;
}

function formatPrice(cents: number): string {
  const rupiah = cents / 100;
  return `Rp ${rupiah.toLocaleString('id-ID')}`;
}

function createSuccessResult(message: string, data?: any, suggestions?: string[]): CommandExecutionResult {
  return {
    success: true,
    message,
    data,
    executionTime: 0, // Will be set by executor
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
 * List all vehicles
 */
async function handleListVehicles(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
      },
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return createSuccessResult(
      `Ditemukan ${vehicles.length} mobil di inventory`,
      vehicles,
      [
        'Cari mobil Toyota',
        'Tampilkan mobil harga di bawah 200 juta',
        'Update harga mobil',
      ]
    );
  } catch (error: any) {
    console.error('List vehicles error:', error);
    return createErrorResult(
      'Gagal menampilkan daftar mobil',
      'DATABASE_ERROR',
      ['Coba lagi', 'Periksa koneksi database']
    );
  }
}

/**
 * Search vehicles with criteria
 */
async function handleSearchVehicle(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    // Build search criteria
    const criteria: any = {
      tenantId,
    };

    // Extract search parameters
    const make = extractEntity<string>(entities, EntityType.VEHICLE_MAKE);
    const model = extractEntity<string>(entities, EntityType.VEHICLE_MODEL);
    const year = extractEntity<number>(entities, EntityType.VEHICLE_YEAR);
    const transmission = extractEntity<string>(entities, EntityType.TRANSMISSION);
    const fuelType = extractEntity<string>(entities, EntityType.FUEL_TYPE);
    const color = extractEntity<string>(entities, EntityType.COLOR);
    const priceRange = extractEntity<{ min?: number; max?: number }>(entities, EntityType.PRICE_RANGE);

    if (make) {
      criteria.make = { contains: make, mode: 'insensitive' };
    }

    if (model) {
      criteria.model = { contains: model, mode: 'insensitive' };
    }

    if (year) {
      criteria.year = year;
    }

    if (transmission) {
      criteria.transmissionType = transmission;
    }

    if (fuelType) {
      criteria.fuelType = fuelType;
    }

    if (color) {
      criteria.color = { contains: color, mode: 'insensitive' };
    }

    if (priceRange) {
      criteria.price = {};
      if (priceRange.min) criteria.price.gte = priceRange.min;
      if (priceRange.max) criteria.price.lte = priceRange.max;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: criteria,
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let message = `Ditemukan ${vehicles.length} mobil`;
    if (make) message += ` ${make}`;
    if (model) message += ` ${model}`;
    if (priceRange) {
      if (priceRange.max) message += ` di bawah ${formatPrice(priceRange.max)}`;
      if (priceRange.min) message += ` di atas ${formatPrice(priceRange.min)}`;
    }

    return createSuccessResult(
      message,
      vehicles,
      vehicles.length > 0 ? [
        'Lihat detail mobil pertama',
        'Update harga mobil',
      ] : [
        'Tampilkan semua mobil',
        'Upload mobil baru',
      ]
    );
  } catch (error: any) {
    console.error('Search vehicles error:', error);
    return createErrorResult(
      'Gagal mencari mobil',
      'SEARCH_ERROR',
      ['Coba dengan kriteria lain', 'Periksa koneksi']
    );
  }
}

/**
 * Update vehicle price
 */
async function handleUpdatePrice(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);
    const newPrice = extractEntity<number>(entities, EntityType.PRICE);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil yang ingin diupdate',
        'MISSING_VEHICLE_ID',
        ['Contoh: Update harga mobil veh-12345 jadi 250 juta']
      );
    }

    if (!newPrice) {
      return createErrorResult(
        'Mohon sebutkan harga baru',
        'MISSING_PRICE',
        ['Contoh: Update harga mobil ' + vehicleId + ' jadi 250 juta']
      );
    }

    // Find vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        [
          'Periksa ID mobil',
          'Gunakan "tampilkan semua mobil" untuk melihat daftar',
        ]
      );
    }

    // Update price
    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { price: newPrice },
    });

    const oldPriceStr = formatPrice(vehicle.price);
    const newPriceStr = formatPrice(newPrice);

    return createSuccessResult(
      `Harga ${vehicle.make} ${vehicle.model} berhasil diupdate dari ${oldPriceStr} menjadi ${newPriceStr}`,
      updated,
      [
        'Lihat mobil ini',
        'Update mobil lain',
        'Tampilkan semua mobil',
      ]
    );
  } catch (error: any) {
    console.error('Update price error:', error);
    return createErrorResult(
      'Gagal mengupdate harga',
      'UPDATE_ERROR',
      ['Coba lagi', 'Periksa ID mobil']
    );
  }
}

/**
 * Mark vehicle as sold
 */
async function handleMarkAsSold(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil yang sudah terjual',
        'MISSING_VEHICLE_ID',
        ['Contoh: Mobil veh-12345 sudah terjual']
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        ['Periksa ID mobil', 'Tampilkan semua mobil']
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'SOLD' },
    });

    return createSuccessResult(
      `${vehicle.make} ${vehicle.model} berhasil ditandai sebagai TERJUAL`,
      updated,
      [
        'Lihat analytics penjualan',
        'Tampilkan mobil available',
      ]
    );
  } catch (error: any) {
    console.error('Mark as sold error:', error);
    return createErrorResult(
      'Gagal menandai mobil sebagai terjual',
      'UPDATE_ERROR',
      ['Coba lagi', 'Periksa ID mobil']
    );
  }
}

/**
 * Mark vehicle as booked
 */
async function handleMarkAsBooked(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil yang dibooking',
        'MISSING_VEHICLE_ID',
        ['Contoh: Mobil veh-12345 sudah booking']
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        ['Periksa ID mobil']
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'BOOKED' },
    });

    return createSuccessResult(
      `${vehicle.make} ${vehicle.model} berhasil ditandai sebagai BOOKING`,
      updated,
      [
        'Set reminder follow-up',
        'Tampilkan mobil available',
      ]
    );
  } catch (error: any) {
    console.error('Mark as booked error:', error);
    return createErrorResult(
      'Gagal menandai mobil sebagai booking',
      'UPDATE_ERROR',
      ['Coba lagi']
    );
  }
}

/**
 * Mark vehicle as available
 */
async function handleMarkAsAvailable(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil',
        'MISSING_VEHICLE_ID',
        ['Contoh: Mobil veh-12345 tersedia lagi']
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        ['Periksa ID mobil']
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'AVAILABLE' },
    });

    return createSuccessResult(
      `${vehicle.make} ${vehicle.model} berhasil ditandai sebagai TERSEDIA`,
      updated,
      [
        'Publish ke website',
        'Tampilkan semua mobil available',
      ]
    );
  } catch (error: any) {
    console.error('Mark as available error:', error);
    return createErrorResult(
      'Gagal menandai mobil sebagai tersedia',
      'UPDATE_ERROR',
      ['Coba lagi']
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

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil',
        'MISSING_VEHICLE_ID',
        ['Contoh: Lihat mobil veh-12345']
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
      include: {
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        ['Periksa ID mobil', 'Tampilkan semua mobil']
      );
    }

    return createSuccessResult(
      `Detail ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      vehicle,
      [
        'Update harga mobil ini',
        'Edit informasi mobil',
        'Publish mobil ini',
      ]
    );
  } catch (error: any) {
    console.error('View vehicle error:', error);
    return createErrorResult(
      'Gagal menampilkan detail mobil',
      'DATABASE_ERROR',
      ['Coba lagi']
    );
  }
}

/**
 * Update vehicle information
 */
async function handleUpdateVehicle(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon sebutkan ID mobil yang ingin diupdate',
        'MISSING_VEHICLE_ID',
        ['Contoh: Update mobil veh-12345']
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        `Mobil dengan ID ${vehicleId} tidak ditemukan`,
        'VEHICLE_NOT_FOUND',
        ['Periksa ID mobil']
      );
    }

    // Extract update fields
    const updateData: any = {};

    const year = extractEntity<number>(entities, EntityType.VEHICLE_YEAR);
    const transmission = extractEntity<string>(entities, EntityType.TRANSMISSION);
    const fuelType = extractEntity<string>(entities, EntityType.FUEL_TYPE);
    const color = extractEntity<string>(entities, EntityType.COLOR);
    const price = extractEntity<number>(entities, EntityType.PRICE);

    if (year) updateData.year = year;
    if (transmission) updateData.transmissionType = transmission;
    if (fuelType) updateData.fuelType = fuelType;
    if (color) updateData.color = color;
    if (price) updateData.price = price;

    if (Object.keys(updateData).length === 0) {
      return createErrorResult(
        'Tidak ada data yang diupdate',
        'NO_UPDATE_DATA',
        [
          'Sebutkan field yang ingin diupdate',
          'Contoh: Update mobil veh-12345 tahun 2020',
        ]
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });

    const updatedFields = Object.keys(updateData).join(', ');

    return createSuccessResult(
      `${vehicle.make} ${vehicle.model} berhasil diupdate (${updatedFields})`,
      updated,
      [
        'Lihat detail mobil',
        'Update field lain',
      ]
    );
  } catch (error: any) {
    console.error('Update vehicle error:', error);
    return createErrorResult(
      'Gagal mengupdate mobil',
      'UPDATE_ERROR',
      ['Coba lagi']
    );
  }
}

// ============================================================================
// Register Command Handlers
// ============================================================================

export function registerInventoryCommands() {
  commandRegistry.registerMultiple([
    {
      intent: CommandIntent.LIST_VEHICLES,
      handler: handleListVehicles,
      description: 'Tampilkan daftar semua kendaraan',
      examples: [
        'Tampilkan semua mobil',
        'Daftar mobil',
        'List semua kendaraan',
        'Mobil apa saja yang ada',
      ],
      category: 'Vehicle Management',
    },
    {
      intent: CommandIntent.SEARCH_VEHICLE,
      handler: handleSearchVehicle,
      description: 'Cari kendaraan dengan kriteria tertentu',
      examples: [
        'Cari mobil Toyota',
        'Tampilkan mobil Avanza',
        'Mobil harga di bawah 200 juta',
        'Cari mobil matic tahun 2020',
      ],
      category: 'Vehicle Management',
    },
    {
      intent: CommandIntent.VIEW_VEHICLE,
      handler: handleViewVehicle,
      requiredEntities: [EntityType.VEHICLE_ID],
      description: 'Lihat detail kendaraan',
      examples: [
        'Lihat mobil veh-12345',
        'Detail mobil veh-abc123',
      ],
      category: 'Vehicle Management',
    },
    {
      intent: CommandIntent.UPDATE_PRICE,
      handler: handleUpdatePrice,
      requiredEntities: [EntityType.VEHICLE_ID, EntityType.PRICE],
      description: 'Update harga kendaraan',
      examples: [
        'Update harga mobil veh-12345 jadi 250 juta',
        'Ganti harga mobil veh-abc jadi 300 juta',
        'Set harga mobil veh-xyz 180 juta',
      ],
      category: 'Pricing',
    },
    {
      intent: CommandIntent.UPDATE_VEHICLE,
      handler: handleUpdateVehicle,
      requiredEntities: [EntityType.VEHICLE_ID],
      description: 'Update informasi kendaraan',
      examples: [
        'Update mobil veh-12345 tahun 2020',
        'Ubah mobil veh-abc warna hitam',
      ],
      category: 'Vehicle Management',
    },
    {
      intent: CommandIntent.MARK_AS_SOLD,
      handler: handleMarkAsSold,
      requiredEntities: [EntityType.VEHICLE_ID],
      description: 'Tandai kendaraan sebagai terjual',
      examples: [
        'Mobil veh-12345 sudah terjual',
        'Tandai mobil veh-abc sold',
        'Mark mobil veh-xyz as sold',
      ],
      category: 'Inventory Status',
    },
    {
      intent: CommandIntent.MARK_AS_BOOKED,
      handler: handleMarkAsBooked,
      requiredEntities: [EntityType.VEHICLE_ID],
      description: 'Tandai kendaraan sebagai booking',
      examples: [
        'Mobil veh-12345 sudah booking',
        'Tandai mobil veh-abc booked',
        'Mark mobil veh-xyz as booked',
      ],
      category: 'Inventory Status',
    },
    {
      intent: CommandIntent.MARK_AS_AVAILABLE,
      handler: handleMarkAsAvailable,
      requiredEntities: [EntityType.VEHICLE_ID],
      description: 'Tandai kendaraan sebagai tersedia',
      examples: [
        'Mobil veh-12345 tersedia lagi',
        'Cancel booking mobil veh-abc',
        'Set mobil veh-xyz available',
      ],
      category: 'Inventory Status',
    },
  ]);
}
