/**
 * Category Command Handlers
 * Epic 3: Story 3.6 - Category Management via Natural Language
 *
 * Handles vehicle category operations and statistics
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
 * List all categories
 */
async function handleListCategories(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            vehicles: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formatted = categories.map(cat => ({
      ...cat,
      vehicleCount: cat._count.vehicles,
    }));

    return createSuccessResult(
      `Ditemukan ${categories.length} kategori`,
      formatted,
      [
        'Lihat mobil di kategori [nama]',
        'Tambah kategori baru',
        'Statistik per kategori',
      ]
    );
  } catch (error: any) {
    console.error('List categories error:', error);
    return createErrorResult(
      'Gagal menampilkan kategori',
      'LIST_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Get vehicles by category
 */
async function handleViewCategory(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const categoryName = extractEntity<string>(entities, EntityType.CATEGORY);

    if (!categoryName) {
      return createErrorResult(
        'Mohon berikan nama kategori',
        'MISSING_CATEGORY',
        ['Contoh: "Lihat mobil di kategori SUV"', 'Atau: "Tampilkan semua kategori"']
      );
    }

    // Find category
    const category = await prisma.category.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (!category) {
      return createErrorResult(
        `Kategori "${categoryName}" tidak ditemukan`,
        'CATEGORY_NOT_FOUND',
        ['Lihat semua kategori', 'Coba dengan nama yang berbeda']
      );
    }

    // Get vehicles in category
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        categoryId: category.id,
        deletedAt: null,
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
      take: 50,
    });

    // Calculate statistics
    const available = vehicles.filter(v => v.status === 'available').length;
    const sold = vehicles.filter(v => v.status === 'sold').length;
    const avgPrice = vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + v.price, 0) / vehicles.length
      : 0;

    const stats = {
      category,
      total: vehicles.length,
      available,
      sold,
      averagePrice: Math.round(avgPrice),
    };

    return createSuccessResult(
      `${vehicles.length} mobil di kategori ${category.name}`,
      { vehicles, stats },
      [
        'Lihat detail mobil pertama',
        'Filter mobil di kategori ini',
        'Analisis harga kategori',
      ]
    );
  } catch (error: any) {
    console.error('View category error:', error);
    return createErrorResult(
      'Gagal menampilkan kategori',
      'VIEW_ERROR',
      ['Coba dengan nama kategori yang berbeda']
    );
  }
}

/**
 * Category statistics
 */
async function handleCategoryStats(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    // Get all categories with vehicle counts
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        vehicles: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            price: true,
            status: true,
          },
        },
      },
    });

    const stats = categories.map(cat => {
      const vehicles = cat.vehicles;
      const available = vehicles.filter(v => v.status === 'available').length;
      const sold = vehicles.filter(v => v.status === 'sold').length;
      const avgPrice = vehicles.length > 0
        ? vehicles.reduce((sum, v) => sum + v.price, 0) / vehicles.length
        : 0;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        totalVehicles: vehicles.length,
        available,
        sold,
        averagePrice: Math.round(avgPrice),
      };
    });

    // Sort by total vehicles
    stats.sort((a, b) => b.totalVehicles - a.totalVehicles);

    return createSuccessResult(
      `Statistik untuk ${stats.length} kategori`,
      stats,
      [
        'Lihat kategori terpopuler',
        'Lihat mobil di kategori tertentu',
        'Export statistik kategori',
      ]
    );
  } catch (error: any) {
    console.error('Category stats error:', error);
    return createErrorResult(
      'Gagal menampilkan statistik kategori',
      'STATS_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Top categories
 */
async function handleTopCategories(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const limit = extractEntity<number>(entities, EntityType.QUANTITY) || 5;

    // Get categories with vehicle counts
    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            vehicles: {
              where: {
                deletedAt: null,
                status: 'available',
              },
            },
          },
        },
      },
    });

    // Sort by vehicle count
    const sorted = categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        vehicleCount: cat._count.vehicles,
      }))
      .sort((a, b) => b.vehicleCount - a.vehicleCount)
      .slice(0, limit);

    return createSuccessResult(
      `Top ${limit} kategori berdasarkan jumlah mobil`,
      sorted,
      [
        'Lihat mobil di kategori pertama',
        'Statistik lengkap kategori',
        'Tambah mobil ke kategori',
      ]
    );
  } catch (error: any) {
    console.error('Top categories error:', error);
    return createErrorResult(
      'Gagal menampilkan top kategori',
      'TOP_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Move vehicle to category
 */
async function handleMoveToCategory(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId, userId } = request;
    const vehicleId = extractEntity<string>(entities, EntityType.VEHICLE_ID);
    const categoryName = extractEntity<string>(entities, EntityType.CATEGORY);

    if (!vehicleId) {
      return createErrorResult(
        'Mohon berikan ID mobil',
        'MISSING_VEHICLE_ID',
        ['Contoh: "Pindahkan mobil [ID] ke kategori SUV"']
      );
    }

    if (!categoryName) {
      return createErrorResult(
        'Mohon berikan nama kategori',
        'MISSING_CATEGORY',
        ['Contoh: "Pindahkan mobil ke kategori SUV"']
      );
    }

    // Find vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });

    if (!vehicle) {
      return createErrorResult(
        'Mobil tidak ditemukan',
        'VEHICLE_NOT_FOUND',
        ['Cek kembali ID mobil', 'Tampilkan semua mobil']
      );
    }

    // Find target category
    const category = await prisma.category.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (!category) {
      return createErrorResult(
        `Kategori "${categoryName}" tidak ditemukan`,
        'CATEGORY_NOT_FOUND',
        ['Lihat semua kategori', 'Buat kategori baru']
      );
    }

    // Update vehicle category
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        categoryId: category.id,
        updatedAt: new Date(),
      },
      include: {
        category: true,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'MOVE_VEHICLE_CATEGORY',
        entityType: 'vehicle',
        entityId: vehicle.id,
        changes: {
          oldCategory: vehicle.category?.name || 'None',
          newCategory: category.name,
        },
      },
    });

    return createSuccessResult(
      `${vehicle.make} ${vehicle.model} dipindahkan ke kategori ${category.name}`,
      updated,
      [
        'Lihat mobil di kategori ini',
        'Pindahkan mobil lain',
        'Lihat detail mobil',
      ]
    );
  } catch (error: any) {
    console.error('Move to category error:', error);
    return createErrorResult(
      'Gagal memindahkan mobil ke kategori',
      'MOVE_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

// ============================================================================
// Register Commands
// ============================================================================

export function registerCategoryCommands() {
  commandRegistry.registerMultiple([
    {
      intent: CommandIntent.LIST_CATEGORIES,
      category: 'category',
      description: 'Tampilkan semua kategori mobil',
      examples: [
        'Tampilkan semua kategori',
        'Lihat kategori mobil',
        'Daftar kategori',
      ],
      requiredEntities: [],
      handler: handleListCategories,
    },
    {
      intent: CommandIntent.VIEW_CATEGORY,
      category: 'category',
      description: 'Lihat mobil dalam kategori tertentu',
      examples: [
        'Lihat mobil di kategori SUV',
        'Tampilkan semua sedan',
        'Mobil di kategori MPV',
      ],
      requiredEntities: [EntityType.CATEGORY],
      handler: handleViewCategory,
    },
    {
      intent: CommandIntent.CATEGORY_STATS,
      category: 'category',
      description: 'Statistik untuk semua kategori',
      examples: [
        'Statistik kategori',
        'Analisis per kategori',
        'Info kategori lengkap',
      ],
      requiredEntities: [],
      handler: handleCategoryStats,
    },
    {
      intent: CommandIntent.TOP_CATEGORIES,
      category: 'category',
      description: 'Kategori dengan mobil terbanyak',
      examples: [
        'Kategori terpopuler',
        'Top 5 kategori',
        'Kategori dengan stock terbanyak',
      ],
      requiredEntities: [],
      handler: handleTopCategories,
    },
    {
      intent: CommandIntent.MOVE_TO_CATEGORY,
      category: 'category',
      description: 'Pindahkan mobil ke kategori lain',
      examples: [
        'Pindahkan mobil [ID] ke kategori SUV',
        'Move mobil ke kategori sedan',
        'Ubah kategori mobil ini ke MPV',
      ],
      requiredEntities: [EntityType.VEHICLE_ID, EntityType.CATEGORY],
      handler: handleMoveToCategory,
    },
  ]);
}
