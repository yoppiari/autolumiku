/**
 * Data Aggregator
 * Epic 7: Utility for aggregating and processing analytics data
 */

import { prisma } from '@/lib/prisma';
import { DateRange, DashboardOverview, DashboardAlert, QuickStat } from './types';
import { analyticsEngine } from './analytics-engine';

export class DataAggregator {
  /**
   * Get dashboard overview with key metrics
   */
  async getDashboardOverview(tenantId: string, dateRange: DateRange): Promise<DashboardOverview> {
    const [salesData, inventoryData, customerData, trafficData, alerts] = await Promise.all([
      this.getSalesOverview(tenantId, dateRange),
      this.getInventoryOverview(tenantId),
      this.getCustomerOverview(tenantId, dateRange),
      this.getTrafficOverview(tenantId, dateRange),
      this.getAlerts(tenantId),
    ]);

    const quickStats: QuickStat[] = [
      {
        label: 'Revenue Today',
        value: salesData.todayRevenue,
        format: 'currency',
        trend: salesData.trend,
        changePercent: salesData.changePercent,
      },
      {
        label: 'Active Listings',
        value: inventoryData.activeCount,
        format: 'number',
      },
      {
        label: 'New Inquiries',
        value: customerData.newInquiries,
        format: 'number',
        trend: customerData.trend,
      },
      {
        label: 'Conversion Rate',
        value: trafficData.conversionRate,
        format: 'percentage',
        trend: trafficData.trend,
      },
    ];

    return {
      sales: salesData,
      inventory: inventoryData,
      customers: customerData,
      traffic: trafficData,
      alerts,
      quickStats,
    };
  }

  /**
   * Get sales overview
   */
  private async getSalesOverview(tenantId: string, dateRange: DateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [currentSales, todaySales] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'SOLD',
          updatedAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        select: {
          price: true,
        },
      }),
      prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'SOLD',
          updatedAt: {
            gte: today,
          },
        },
        select: {
          price: true,
        },
      }),
    ]);

    const totalRevenue = currentSales.reduce((sum, s) => sum + s.price, 0);
    const totalSales = currentSales.length;
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.price, 0);

    return {
      totalRevenue,
      totalSales,
      todayRevenue,
      trend: 'up' as const,
      changePercent: 12.5,
    };
  }

  /**
   * Get inventory overview
   */
  private async getInventoryOverview(tenantId: string) {
    const [total, totalValue] = await Promise.all([
      prisma.vehicle.count({
        where: {
          tenantId,
          status: {
            in: ['PUBLISHED', 'DRAFT', 'BOOKED'],
          },
        },
      }),
      prisma.vehicle.aggregate({
        where: {
          tenantId,
          status: {
            in: ['PUBLISHED', 'DRAFT', 'BOOKED'],
          },
        },
        _sum: {
          price: true,
        },
      }),
    ]);

    const activeCount = await prisma.vehicle.count({
      where: {
        tenantId,
        status: 'AVAILABLE',
      },
    });

    // Calculate simple turnover rate
    const turnoverRate = 8.5; // Mock

    return {
      totalVehicles: total,
      totalValue: totalValue._sum.price || 0,
      activeCount,
      turnoverRate,
      trend: 'neutral' as const,
    };
  }

  /**
   * Get customer overview
   */
  private async getCustomerOverview(tenantId: string, dateRange: DateRange) {
    const customers = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        intent: {
          in: ['search_vehicle', 'view_vehicle'],
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });

    const totalCustomers = customers.length;

    // New inquiries today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newInquiries = await prisma.commandHistory.count({
      where: {
        tenantId,
        timestamp: {
          gte: today,
        },
        intent: 'search_vehicle',
      },
    });

    const repeatRate = 25; // Mock

    return {
      totalCustomers,
      newCustomers: Math.floor(totalCustomers * 0.6),
      newInquiries,
      repeatRate,
      trend: 'up' as const,
    };
  }

  /**
   * Get traffic overview
   */
  private async getTrafficOverview(tenantId: string, dateRange: DateRange) {
    const views = await prisma.commandHistory.count({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        intent: 'view_vehicle',
      },
    });

    const inquiries = await prisma.commandHistory.count({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        intent: 'search_vehicle',
      },
    });

    const conversionRate = views > 0 ? (inquiries / views) * 100 : 0;

    return {
      totalVisitors: views,
      conversionRate: Math.round(conversionRate * 10) / 10,
      trend: 'up' as const,
    };
  }

  /**
   * Get alerts and notifications
   */
  private async getAlerts(tenantId: string): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    // Check for slow-moving inventory
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const slowMoving = await prisma.vehicle.count({
      where: {
        tenantId,
        status: {
          in: ['PUBLISHED', 'DRAFT'],
        },
        createdAt: {
          lte: ninetyDaysAgo,
        },
      },
    });

    if (slowMoving > 0) {
      alerts.push({
        id: 'slow-inventory',
        type: 'warning',
        title: 'Slow-Moving Inventory',
        message: `${slowMoving} vehicles have been in inventory for over 90 days`,
        actionLabel: 'View Vehicles',
        actionUrl: '/inventory?filter=slow-moving',
        createdAt: new Date(),
      });
    }

    // Check for low inventory
    const totalInventory = await prisma.vehicle.count({
      where: {
        tenantId,
        status: 'AVAILABLE',
      },
    });

    if (totalInventory < 10) {
      alerts.push({
        id: 'low-inventory',
        type: 'info',
        title: 'Low Inventory Alert',
        message: `Only ${totalInventory} vehicles available. Consider adding more inventory.`,
        actionLabel: 'Add Vehicles',
        actionUrl: '/inventory/add',
        createdAt: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Aggregate data by time period
   */
  async aggregateByPeriod(
    tenantId: string,
    metric: 'revenue' | 'sales' | 'inquiries',
    dateRange: DateRange,
    grouping: 'day' | 'week' | 'month'
  ): Promise<Array<{ period: string; value: number }>> {
    if (metric === 'revenue' || metric === 'sales') {
      const vehicles = await prisma.vehicle.findMany({
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

      const data = vehicles.map(v => ({
        date: v.updatedAt,
        value: metric === 'revenue' ? v.price : 1,
      }));

      const grouped = analyticsEngine.groupByPeriod(data, grouping);
      return grouped.map(g => ({ period: g.period, value: g.value }));
    }

    if (metric === 'inquiries') {
      const inquiries = await prisma.commandHistory.findMany({
        where: {
          tenantId,
          intent: 'search_vehicle',
          timestamp: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        select: {
          timestamp: true,
        },
      });

      const data = inquiries.map(i => ({ date: i.timestamp, value: 1 }));
      const grouped = analyticsEngine.groupByPeriod(data, grouping);
      return grouped.map(g => ({ period: g.period, value: g.value }));
    }

    return [];
  }
}

export const dataAggregator = new DataAggregator();
