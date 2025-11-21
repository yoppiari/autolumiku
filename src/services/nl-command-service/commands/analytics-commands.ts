/**
 * Analytics Command Handlers
 * Epic 3: Story 3.6 - Analytics & Reporting via Natural Language
 *
 * Handles analytics queries, sales reports, and insights
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

function getDateRange(period: 'today' | 'week' | 'month' | 'year' | 'custom'): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Show analytics dashboard
 */
async function handleShowAnalytics(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const dateRange = getDateRange('month');

    // Get inventory stats
    const totalVehicles = await prisma.vehicle.count({
      where: {
        tenantId,
        deletedAt: null,
      },
    });

    const availableVehicles = await prisma.vehicle.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'available',
      },
    });

    const soldVehicles = await prisma.vehicle.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'sold',
        updatedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
    });

    // Get leads stats
    const totalLeads = await prisma.lead.count({
      where: {
        tenantId,
      },
    });

    const newLeads = await prisma.lead.count({
      where: {
        tenantId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
    });

    // Get revenue (from sold vehicles this month)
    const soldThisMonth = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'sold',
        updatedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        price: true,
      },
    });

    const revenue = soldThisMonth.reduce((sum, v) => sum + v.price, 0);

    const analytics = {
      inventory: {
        total: totalVehicles,
        available: availableVehicles,
        sold: soldVehicles,
      },
      leads: {
        total: totalLeads,
        newThisMonth: newLeads,
      },
      revenue: {
        thisMonth: revenue,
        formatted: formatPrice(revenue),
      },
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    };

    return createSuccessResult(
      `Analytics bulan ini: ${soldVehicles} mobil terjual, ${newLeads} leads baru`,
      analytics,
      [
        'Lihat mobil terlaris',
        'Analisis harga',
        'Export laporan bulan ini',
      ]
    );
  } catch (error: any) {
    console.error('Show analytics error:', error);
    return createErrorResult(
      'Gagal menampilkan analytics',
      'ANALYTICS_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Get top selling vehicles
 */
async function handleTopSelling(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const period = extractEntity<string>(entities, EntityType.DATE_RANGE) || 'month';
    const limit = extractEntity<number>(entities, EntityType.QUANTITY) || 5;
    const dateRange = getDateRange(period as any);

    // Get sold vehicles grouped by make/model
    const soldVehicles = await prisma.vehicle.groupBy({
      by: ['make', 'model'],
      where: {
        tenantId,
        status: 'sold',
        updatedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    const formatted = soldVehicles.map((item, index) => ({
      rank: index + 1,
      make: item.make,
      model: item.model,
      soldCount: item._count.id,
    }));

    return createSuccessResult(
      `Top ${limit} mobil terlaris periode ini`,
      formatted,
      [
        'Lihat detail mobil pertama',
        'Cari mobil serupa',
        'Analisis harga mobil terlaris',
      ]
    );
  } catch (error: any) {
    console.error('Top selling error:', error);
    return createErrorResult(
      'Gagal menampilkan mobil terlaris',
      'TOP_SELLING_ERROR',
      ['Coba dengan periode yang berbeda']
    );
  }
}

/**
 * Sales report
 */
async function handleSalesReport(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const period = extractEntity<string>(entities, EntityType.DATE_RANGE) || 'month';
    const dateRange = getDateRange(period as any);

    // Get sold vehicles
    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'sold',
        updatedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        updatedAt: true,
      },
    });

    // Calculate statistics
    const totalSales = soldVehicles.length;
    const totalRevenue = soldVehicles.reduce((sum, v) => sum + v.price, 0);
    const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Group by make
    const salesByMake: Record<string, { count: number; revenue: number }> = {};
    soldVehicles.forEach(v => {
      if (!salesByMake[v.make]) {
        salesByMake[v.make] = { count: 0, revenue: 0 };
      }
      salesByMake[v.make].count++;
      salesByMake[v.make].revenue += v.price;
    });

    const report = {
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
      summary: {
        totalSales,
        totalRevenue,
        averagePrice: Math.round(avgPrice),
      },
      byMake: Object.entries(salesByMake).map(([make, data]) => ({
        make,
        sales: data.count,
        revenue: data.revenue,
      })),
      recentSales: soldVehicles.slice(0, 10),
    };

    return createSuccessResult(
      `Laporan penjualan: ${totalSales} mobil terjual, total ${formatPrice(totalRevenue)}`,
      report,
      [
        'Export laporan',
        'Lihat mobil terlaris',
        'Analisis harga',
      ]
    );
  } catch (error: any) {
    console.error('Sales report error:', error);
    return createErrorResult(
      'Gagal membuat laporan penjualan',
      'REPORT_ERROR',
      ['Coba dengan periode yang berbeda']
    );
  }
}

/**
 * Lead analytics
 */
async function handleLeadAnalytics(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;
    const dateRange = getDateRange('month');

    // Get leads
    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        id: true,
        status: true,
        source: true,
        createdAt: true,
      },
    });

    // Group by status
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    leads.forEach(lead => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      if (lead.source) {
        bySource[lead.source] = (bySource[lead.source] || 0) + 1;
      }
    });

    // Calculate conversion rate (won / total)
    const wonLeads = byStatus['won'] || 0;
    const conversionRate = leads.length > 0 ? (wonLeads / leads.length) * 100 : 0;

    const analytics = {
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
      summary: {
        total: leads.length,
        won: wonLeads,
        conversionRate: Math.round(conversionRate * 10) / 10, // 1 decimal
      },
      byStatus,
      bySource,
      recentLeads: leads.slice(0, 10),
    };

    return createSuccessResult(
      `Lead analytics: ${leads.length} leads, ${conversionRate.toFixed(1)}% conversion rate`,
      analytics,
      [
        'Lihat leads terbaru',
        'Follow up leads',
        'Export lead report',
      ]
    );
  } catch (error: any) {
    console.error('Lead analytics error:', error);
    return createErrorResult(
      'Gagal menampilkan analytics leads',
      'LEAD_ANALYTICS_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

/**
 * Inventory insights
 */
async function handleInventoryInsights(
  entities: CommandEntity[],
  request: CommandExecutionRequest
): Promise<CommandExecutionResult> {
  try {
    const { tenantId } = request;

    // Get all vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        status: true,
        transmission: true,
        fuelType: true,
        createdAt: true,
      },
    });

    // Calculate insights
    const total = vehicles.length;
    const available = vehicles.filter(v => v.status === 'available').length;
    const sold = vehicles.filter(v => v.status === 'sold').length;

    // Price distribution
    const prices = vehicles.map(v => v.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Age distribution (days since added)
    const now = new Date();
    const ages = vehicles.map(v => {
      const days = Math.floor((now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    });
    const avgAge = ages.reduce((sum, a) => sum + a, 0) / ages.length;

    // Most common make
    const makeCount: Record<string, number> = {};
    vehicles.forEach(v => {
      makeCount[v.make] = (makeCount[v.make] || 0) + 1;
    });
    const topMake = Object.entries(makeCount).sort((a, b) => b[1] - a[1])[0];

    // Transmission distribution
    const transmissionCount: Record<string, number> = {};
    vehicles.forEach(v => {
      if (v.transmission) {
        transmissionCount[v.transmission] = (transmissionCount[v.transmission] || 0) + 1;
      }
    });

    const insights = {
      inventory: {
        total,
        available,
        sold,
        turnoverRate: sold / total * 100,
      },
      pricing: {
        average: Math.round(avgPrice),
        min: minPrice,
        max: maxPrice,
      },
      aging: {
        averageDays: Math.round(avgAge),
        oldestDays: Math.max(...ages),
      },
      popular: {
        topMake: topMake ? topMake[0] : 'N/A',
        topMakeCount: topMake ? topMake[1] : 0,
      },
      distribution: {
        byTransmission: transmissionCount,
      },
    };

    return createSuccessResult(
      `Inventory insights: ${total} mobil, avg ${Math.round(avgAge)} hari`,
      insights,
      [
        'Lihat mobil terlama',
        'Analisis harga',
        'Tampilkan mobil terpopuler',
      ]
    );
  } catch (error: any) {
    console.error('Inventory insights error:', error);
    return createErrorResult(
      'Gagal menampilkan inventory insights',
      'INSIGHTS_ERROR',
      ['Coba lagi atau hubungi support']
    );
  }
}

// ============================================================================
// Register Commands
// ============================================================================

export function registerAnalyticsCommands() {
  commandRegistry.registerMultiple([
    {
      intent: CommandIntent.SHOW_ANALYTICS,
      category: 'analytics',
      description: 'Tampilkan dashboard analytics',
      examples: [
        'Tampilkan analytics',
        'Dashboard analytics',
        'Lihat statistik bulan ini',
      ],
      requiredEntities: [],
      handler: handleShowAnalytics,
    },
    {
      intent: CommandIntent.TOP_SELLING,
      category: 'analytics',
      description: 'Mobil terlaris',
      examples: [
        'Mobil terlaris bulan ini',
        'Top 10 mobil paling laku',
        'Lihat mobil best seller',
      ],
      requiredEntities: [],
      handler: handleTopSelling,
    },
    {
      intent: CommandIntent.SALES_REPORT,
      category: 'analytics',
      description: 'Laporan penjualan',
      examples: [
        'Laporan penjualan bulan ini',
        'Sales report minggu ini',
        'Lihat hasil penjualan',
      ],
      requiredEntities: [],
      handler: handleSalesReport,
    },
    {
      intent: CommandIntent.LEAD_ANALYTICS,
      category: 'analytics',
      description: 'Analytics untuk customer leads',
      examples: [
        'Analytics leads',
        'Statistik customer leads',
        'Conversion rate leads',
      ],
      requiredEntities: [],
      handler: handleLeadAnalytics,
    },
    {
      intent: CommandIntent.INVENTORY_INSIGHTS,
      category: 'analytics',
      description: 'Insights tentang inventory',
      examples: [
        'Inventory insights',
        'Analisis inventory',
        'Lihat kondisi stock',
      ],
      requiredEntities: [],
      handler: handleInventoryInsights,
    },
  ]);
}
