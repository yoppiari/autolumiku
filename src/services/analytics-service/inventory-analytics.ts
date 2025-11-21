/**
 * Inventory Analytics Service
 * Epic 7: Story 7.3 - Inventory Turnover & Sales Velocity Analysis
 */

import { prisma } from '@/lib/prisma';
import {
  AnalyticsFilter,
  InventoryAnalytics,
  InventoryMetrics,
  InventoryAgingData,
  TurnoverByCategory,
  SalesVelocity,
} from './types';
import { analyticsEngine } from './analytics-engine';

export class InventoryAnalyticsService {
  /**
   * Get complete inventory analytics
   */
  async getInventoryAnalytics(filter: AnalyticsFilter): Promise<InventoryAnalytics> {
    analyticsEngine.validateFilter(filter);

    const [metrics, agingAnalysis, turnoverByCategory, salesVelocity, slowMovingVehicles, fastMovingCategories] =
      await Promise.all([
        this.getInventoryMetrics(filter),
        this.getAgingAnalysis(filter),
        this.getTurnoverByCategory(filter),
        this.getSalesVelocity(filter),
        this.getSlowMovingVehicles(filter),
        this.getFastMovingCategories(filter),
      ]);

    return {
      metrics,
      agingAnalysis,
      turnoverByCategory,
      salesVelocity,
      slowMovingVehicles,
      fastMovingCategories,
    };
  }

  /**
   * Get inventory metrics
   */
  async getInventoryMetrics(filter: AnalyticsFilter): Promise<InventoryMetrics> {
    const { tenantId, dateRange, comparisonPeriod = 'previous' } = filter;

    // Current inventory
    const currentInventory = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: {
          in: ['PUBLISHED', 'DRAFT', 'BOOKED'],
        },
      },
      select: {
        id: true,
        price: true,
        createdAt: true,
      },
    });

    // Calculate metrics
    const totalVehicles = currentInventory.length;
    const totalInventoryValue = currentInventory.reduce((sum, v) => sum + v.price, 0);

    // Average days on lot
    const now = new Date();
    const daysOnLot = currentInventory.map(v => {
      return (now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    });
    const averageDaysOnLot = analyticsEngine.calculateAverage(daysOnLot);

    // Vehicles sold in period
    const soldThisPeriod = await prisma.vehicle.count({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    });

    // Turnover rate: sold / (sold + current inventory)
    const turnoverRate = totalVehicles > 0
      ? analyticsEngine.calculatePercentage(soldThisPeriod, soldThisPeriod + totalVehicles)
      : 0;

    // Available count
    const availableCount = await prisma.vehicle.count({
      where: {
        tenantId,
        status: 'AVAILABLE',
      },
    });

    // Get comparison data
    let previousMetrics: any = {};
    if (comparisonPeriod !== 'none') {
      const comparisonRange = analyticsEngine.getComparisonDateRange(dateRange, comparisonPeriod);
      if (comparisonRange) {
        const previousSold = await prisma.vehicle.count({
          where: {
            tenantId,
            status: 'SOLD',
            updatedAt: {
              gte: comparisonRange.startDate,
              lte: comparisonRange.endDate,
            },
          },
        });
        previousMetrics = { soldThisPeriod: previousSold };
      }
    }

    return {
      totalVehicles: analyticsEngine.calculateMetricValue(totalVehicles),
      totalInventoryValue: analyticsEngine.calculateMetricValue(totalInventoryValue),
      averageDaysOnLot: analyticsEngine.calculateMetricValue(averageDaysOnLot),
      turnoverRate: analyticsEngine.calculateMetricValue(turnoverRate),
      soldThisPeriod: analyticsEngine.calculateMetricValue(soldThisPeriod, previousMetrics.soldThisPeriod),
      availableCount: analyticsEngine.calculateMetricValue(availableCount),
    };
  }

  /**
   * Get inventory aging analysis
   */
  async getAgingAnalysis(filter: AnalyticsFilter): Promise<InventoryAgingData[]> {
    const { tenantId } = filter;

    const inventory = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: {
          in: ['PUBLISHED', 'DRAFT', 'BOOKED'],
        },
      },
      select: {
        id: true,
        price: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const aging = {
      '0-30': { count: 0, value: 0 },
      '31-60': { count: 0, value: 0 },
      '61-90': { count: 0, value: 0 },
      '90+': { count: 0, value: 0 },
    };

    inventory.forEach(v => {
      const days = (now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      let bracket: '0-30' | '31-60' | '61-90' | '90+';

      if (days <= 30) bracket = '0-30';
      else if (days <= 60) bracket = '31-60';
      else if (days <= 90) bracket = '61-90';
      else bracket = '90+';

      aging[bracket].count++;
      aging[bracket].value += v.price;
    });

    const totalCount = inventory.length;

    return Object.entries(aging).map(([bracket, data]) => ({
      ageBracket: bracket as '0-30' | '31-60' | '61-90' | '90+',
      vehicleCount: data.count,
      totalValue: data.value,
      percentOfInventory: analyticsEngine.calculatePercentage(data.count, totalCount),
    }));
  }

  /**
   * Get turnover by category
   */
  async getTurnoverByCategory(filter: AnalyticsFilter): Promise<TurnoverByCategory[]> {
    const { tenantId, dateRange } = filter;

    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        make: true,
        model: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Group by make and model
    const grouped = new Map<string, any[]>();

    soldVehicles.forEach(v => {
      const key = `${v.make}|${v.model}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(v);
    });

    // Calculate metrics per category
    const results: TurnoverByCategory[] = [];

    grouped.forEach((vehicles, key) => {
      const [make, model] = key.split('|');
      const totalSold = vehicles.length;
      const averagePrice = analyticsEngine.calculateAverage(vehicles.map(v => v.price));

      const daysOnLot = vehicles.map(v => {
        return (v.updatedAt.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      });
      const averageDaysOnLot = analyticsEngine.calculateAverage(daysOnLot);

      // Turnover rate: how quickly vehicles sell
      const turnoverRate = averageDaysOnLot > 0 ? 365 / averageDaysOnLot : 0;

      results.push({
        make,
        model,
        totalSold,
        averageDaysOnLot,
        averagePrice,
        turnoverRate,
      });
    });

    return results.sort((a, b) => b.totalSold - a.totalSold);
  }

  /**
   * Get sales velocity (units sold per period)
   */
  async getSalesVelocity(filter: AnalyticsFilter): Promise<SalesVelocity[]> {
    const { tenantId, dateRange } = filter;

    const sales = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        updatedAt: true,
        price: true,
      },
    });

    // Group by month
    const grouped = analyticsEngine.groupByPeriod(
      sales.map(s => ({ date: s.updatedAt, value: s.price })),
      'month'
    );

    return grouped.map(g => ({
      period: g.period,
      unitsSold: g.count,
      revenue: g.value,
      averagePrice: g.count > 0 ? g.value / g.count : 0,
    }));
  }

  /**
   * Get slow moving vehicles (on lot > 90 days)
   */
  async getSlowMovingVehicles(filter: AnalyticsFilter): Promise<any[]> {
    const { tenantId } = filter;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: {
          in: ['PUBLISHED', 'DRAFT'],
        },
        createdAt: {
          lte: ninetyDaysAgo,
        },
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 20,
    });
  }

  /**
   * Get fast moving categories (quickest turnover)
   */
  async getFastMovingCategories(filter: AnalyticsFilter): Promise<TurnoverByCategory[]> {
    const turnoverData = await this.getTurnoverByCategory(filter);
    return turnoverData
      .filter(t => t.totalSold >= 2) // At least 2 sales
      .sort((a, b) => a.averageDaysOnLot - b.averageDaysOnLot)
      .slice(0, 10);
  }
}

export const inventoryAnalyticsService = new InventoryAnalyticsService();
