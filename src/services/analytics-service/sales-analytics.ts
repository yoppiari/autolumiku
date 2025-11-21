/**
 * Sales Analytics Service
 * Epic 7: Story 7.1 - Lead Conversion & Sales Performance Analytics
 */

import { prisma } from '@/lib/prisma';
import {
  AnalyticsFilter,
  SalesAnalytics,
  SalesMetrics,
  ConversionFunnel,
  ConversionFunnelStage,
  SalespersonPerformance,
  SalesByCategoryData,
  ChartDataPoint,
} from './types';
import { analyticsEngine } from './analytics-engine';

export class SalesAnalyticsService {
  /**
   * Get complete sales analytics
   */
  async getSalesAnalytics(filter: AnalyticsFilter): Promise<SalesAnalytics> {
    analyticsEngine.validateFilter(filter);

    const [metrics, conversionFunnel, salesByPeriod, revenueByPeriod, salesByCategory, topPerformers, recentSales] =
      await Promise.all([
        this.getSalesMetrics(filter),
        this.getConversionFunnel(filter),
        this.getSalesByPeriod(filter),
        this.getRevenueByPeriod(filter),
        this.getSalesByCategory(filter),
        this.getTopPerformers(filter),
        this.getRecentSales(filter),
      ]);

    return {
      metrics,
      conversionFunnel,
      salesByPeriod,
      revenueByPeriod,
      salesByCategory,
      topPerformers,
      recentSales,
    };
  }

  /**
   * Get sales metrics with comparison
   */
  async getSalesMetrics(filter: AnalyticsFilter): Promise<SalesMetrics> {
    const { tenantId, dateRange, comparisonPeriod = 'previous' } = filter;

    // Current period data
    const currentSales = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        id: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Comparison period data
    let previousSales: any[] = [];
    if (comparisonPeriod !== 'none') {
      const comparisonRange = analyticsEngine.getComparisonDateRange(dateRange, comparisonPeriod);
      if (comparisonRange) {
        previousSales = await prisma.vehicle.findMany({
          where: {
            tenantId,
            status: 'SOLD',
            updatedAt: {
              gte: comparisonRange.startDate,
              lte: comparisonRange.endDate,
            },
          },
          select: {
            price: true,
          },
        });
      }
    }

    // Calculate metrics
    const totalSales = currentSales.length;
    const previousTotalSales = previousSales.length;
    const totalRevenue = currentSales.reduce((sum, s) => sum + s.price, 0);
    const previousTotalRevenue = previousSales.reduce((sum, s) => sum + s.price, 0);
    const averageSalePrice = totalSales > 0 ? totalRevenue / totalSales : 0;
    const previousAverageSalePrice = previousTotalSales > 0 ? previousTotalRevenue / previousTotalSales : 0;

    // Calculate sales cycle (days from created to sold)
    const salesCycleDays = currentSales.length > 0
      ? analyticsEngine.calculateAverage(
          currentSales.map(s => {
            const days = (s.updatedAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return days;
          })
        )
      : 0;

    // Get lead data for conversion metrics
    const totalLeads = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::int as count
      FROM command_history
      WHERE "tenantId" = ${tenantId}
        AND intent IN ('search_vehicle', 'view_vehicle')
        AND timestamp >= ${dateRange.startDate}
        AND timestamp <= ${dateRange.endDate}
        AND success = true
    `;

    const leadCount = Number(totalLeads[0]?.count || 0);
    const conversionRate = analyticsEngine.calculateConversionRate(totalSales, leadCount);

    return {
      totalSales: analyticsEngine.calculateMetricValue(totalSales, previousTotalSales),
      totalRevenue: analyticsEngine.calculateMetricValue(totalRevenue, previousTotalRevenue),
      averageSalePrice: analyticsEngine.calculateMetricValue(averageSalePrice, previousAverageSalePrice),
      conversionRate: analyticsEngine.calculateMetricValue(conversionRate),
      salesCycleDays: analyticsEngine.calculateMetricValue(salesCycleDays),
      closeRate: analyticsEngine.calculateMetricValue(conversionRate), // Same as conversion for now
    };
  }

  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(filter: AnalyticsFilter): Promise<ConversionFunnel> {
    const { tenantId, dateRange } = filter;

    // Count commands by intent (proxy for funnel stages)
    const funnelData = await prisma.commandHistory.groupBy({
      by: ['intent'],
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        success: true,
      },
      _count: {
        id: true,
      },
    });

    // Map intents to funnel stages
    const inquiries = funnelData.find(f => f.intent === 'search_vehicle')?._count.id || 0;
    const viewDetails = funnelData.find(f => f.intent === 'view_vehicle')?._count.id || 0;
    const priceChecks = funnelData.find(f => f.intent === 'update_price')?._count.id || 0;

    // Get actual sales
    const sales = await prisma.vehicle.count({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    });

    // Build funnel stages
    const stages: ConversionFunnelStage[] = [
      {
        stage: 'inquiry',
        stageLabel: 'Inquiry / Search',
        count: inquiries,
        conversionRate: viewDetails > 0 ? analyticsEngine.calculateConversionRate(viewDetails, inquiries) : 0,
        dropoffRate: viewDetails > 0 ? 100 - analyticsEngine.calculateConversionRate(viewDetails, inquiries) : 0,
      },
      {
        stage: 'test_drive',
        stageLabel: 'View Details',
        count: viewDetails,
        conversionRate: priceChecks > 0 ? analyticsEngine.calculateConversionRate(priceChecks, viewDetails) : 0,
        dropoffRate: priceChecks > 0 ? 100 - analyticsEngine.calculateConversionRate(priceChecks, viewDetails) : 0,
      },
      {
        stage: 'negotiation',
        stageLabel: 'Price Discussion',
        count: priceChecks,
        conversionRate: sales > 0 ? analyticsEngine.calculateConversionRate(sales, priceChecks) : 0,
        dropoffRate: sales > 0 ? 100 - analyticsEngine.calculateConversionRate(sales, priceChecks) : 0,
      },
      {
        stage: 'closed',
        stageLabel: 'Sold',
        count: sales,
        conversionRate: 0,
        dropoffRate: 0,
      },
    ];

    const overallConversionRate = inquiries > 0 ? analyticsEngine.calculateConversionRate(sales, inquiries) : 0;

    return {
      stages,
      overallConversionRate,
      totalInquiries: inquiries,
      totalSales: sales,
    };
  }

  /**
   * Get sales by period (for charts)
   */
  async getSalesByPeriod(filter: AnalyticsFilter): Promise<ChartDataPoint[]> {
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
      },
    });

    // Group by day/week/month based on date range
    const daysDiff = (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const grouping = daysDiff <= 7 ? 'day' : daysDiff <= 90 ? 'week' : 'month';

    const grouped = analyticsEngine.groupByPeriod(
      sales.map(s => ({ date: s.updatedAt, value: 1 })),
      grouping
    );

    return grouped.map(g => ({
      date: g.period,
      value: g.value,
      label: g.period,
    }));
  }

  /**
   * Get revenue by period (for charts)
   */
  async getRevenueByPeriod(filter: AnalyticsFilter): Promise<ChartDataPoint[]> {
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

    // Group by day/week/month
    const daysDiff = (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const grouping = daysDiff <= 7 ? 'day' : daysDiff <= 90 ? 'week' : 'month';

    const grouped = analyticsEngine.groupByPeriod(
      sales.map(s => ({ date: s.updatedAt, value: s.price })),
      grouping
    );

    return grouped.map(g => ({
      date: g.period,
      value: g.value,
      label: analyticsEngine.formatCurrency(g.value),
    }));
  }

  /**
   * Get sales by category
   */
  async getSalesByCategory(filter: AnalyticsFilter): Promise<SalesByCategoryData[]> {
    const { tenantId, dateRange } = filter;

    const salesByMake = await prisma.vehicle.groupBy({
      by: ['make'],
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        price: true,
      },
    });

    const totalSales = salesByMake.reduce((sum, s) => sum + s._count.id, 0);
    const totalRevenue = salesByMake.reduce((sum, s) => sum + (s._sum.price || 0), 0);

    return salesByMake
      .map(s => ({
        category: s.make,
        salesCount: s._count.id,
        revenue: s._sum.price || 0,
        averagePrice: s._count.id > 0 ? (s._sum.price || 0) / s._count.id : 0,
        percentOfTotal: analyticsEngine.calculatePercentage(s._count.id, totalSales),
      }))
      .sort((a, b) => b.salesCount - a.salesCount);
  }

  /**
   * Get top performing salespeople
   */
  async getTopPerformers(filter: AnalyticsFilter): Promise<SalespersonPerformance[]> {
    const { tenantId, dateRange } = filter;

    const salesByUser = await prisma.vehicle.groupBy({
      by: ['createdBy'],
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        price: true,
      },
    });

    // Get user details
    const userIds = salesByUser.map(s => s.createdBy);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Calculate performance metrics
    const totalLeads = await prisma.commandHistory.count({
      where: {
        tenantId,
        intent: 'search_vehicle',
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        success: true,
      },
    });

    return salesByUser
      .map(s => {
        const user = userMap.get(s.createdBy);
        const totalSales = s._count.id;
        const totalRevenue = s._sum.price || 0;
        const averageSalePrice = totalSales > 0 ? totalRevenue / totalSales : 0;
        const conversionRate = totalLeads > 0 ? analyticsEngine.calculateConversionRate(totalSales, totalLeads) : 0;

        return {
          userId: s.createdBy,
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          totalSales,
          totalRevenue,
          averageSalePrice,
          conversionRate,
          responseTime: 30, // Mock: would need actual lead response tracking
          customerSatisfaction: 4.5, // Mock: would need actual rating system
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }

  /**
   * Get recent sales
   */
  async getRecentSales(filter: AnalyticsFilter): Promise<any[]> {
    const { tenantId, dateRange } = filter;

    return await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
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
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });
  }
}

export const salesAnalyticsService = new SalesAnalyticsService();
