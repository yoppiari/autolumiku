/**
 * Customer Analytics Service
 * Epic 7: Story 7.4 - Customer Demographics & Behavior Analysis
 */

import { prisma } from '@/lib/prisma';
import {
  AnalyticsFilter,
  CustomerAnalytics,
  CustomerMetrics,
  DemographicData,
  CustomerPreference,
  CustomerBehavior,
} from './types';
import { analyticsEngine } from './analytics-engine';

export class CustomerAnalyticsService {
  /**
   * Get complete customer analytics
   */
  async getCustomerAnalytics(filter: AnalyticsFilter): Promise<CustomerAnalytics> {
    analyticsEngine.validateFilter(filter);

    const [metrics, ageDistribution, locationDistribution, incomeDistribution, vehiclePreferences, behaviorPatterns, topCustomers] =
      await Promise.all([
        this.getCustomerMetrics(filter),
        this.getAgeDistribution(filter),
        this.getLocationDistribution(filter),
        this.getIncomeDistribution(filter),
        this.getVehiclePreferences(filter),
        this.getBehaviorPatterns(filter),
        this.getTopCustomers(filter),
      ]);

    return {
      metrics,
      ageDistribution,
      locationDistribution,
      incomeDistribution,
      vehiclePreferences,
      behaviorPatterns,
      topCustomers,
    };
  }

  /**
   * Get customer metrics
   */
  async getCustomerMetrics(filter: AnalyticsFilter): Promise<CustomerMetrics> {
    const { tenantId, dateRange, comparisonPeriod = 'previous' } = filter;

    // Count unique users who made searches/inquiries
    const uniqueUsers = await prisma.commandHistory.findMany({
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

    const totalCustomers = uniqueUsers.length;

    // New customers (first interaction in period)
    const newCustomers = await this.getNewCustomersCount(tenantId, dateRange);

    // Repeat customers (had interactions before this period)
    const repeatCustomers = totalCustomers - newCustomers;

    // Customer lifetime value (average purchase value per customer)
    const purchases = await prisma.vehicle.findMany({
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
        createdBy: true,
      },
    });

    const customerLifetimeValue = purchases.length > 0
      ? analyticsEngine.calculateAverage(purchases.map(p => p.price))
      : 0;

    // Repeat purchase rate
    const customersWithMultiplePurchases = new Set(
      purchases.map(p => p.createdBy)
    ).size;

    const repeatPurchaseRate = totalCustomers > 0
      ? analyticsEngine.calculatePercentage(customersWithMultiplePurchases, totalCustomers)
      : 0;

    // Referral rate (mock - would need actual referral tracking)
    const referralRate = 15; // Mock: 15% referral rate

    // Get comparison data
    let previousMetrics: any = {};
    if (comparisonPeriod !== 'none') {
      const comparisonRange = analyticsEngine.getComparisonDateRange(dateRange, comparisonPeriod);
      if (comparisonRange) {
        const prevUniqueUsers = await prisma.commandHistory.findMany({
          where: {
            tenantId,
            timestamp: {
              gte: comparisonRange.startDate,
              lte: comparisonRange.endDate,
            },
            intent: {
              in: ['search_vehicle', 'view_vehicle'],
            },
          },
          distinct: ['userId'],
        });
        previousMetrics.totalCustomers = prevUniqueUsers.length;
      }
    }

    return {
      totalCustomers: analyticsEngine.calculateMetricValue(totalCustomers, previousMetrics.totalCustomers),
      newCustomers: analyticsEngine.calculateMetricValue(newCustomers),
      repeatCustomers: analyticsEngine.calculateMetricValue(repeatCustomers),
      customerLifetimeValue: analyticsEngine.calculateMetricValue(customerLifetimeValue),
      repeatPurchaseRate: analyticsEngine.calculateMetricValue(repeatPurchaseRate),
      referralRate: analyticsEngine.calculateMetricValue(referralRate),
    };
  }

  /**
   * Get new customers count
   */
  private async getNewCustomersCount(tenantId: string, dateRange: { startDate: Date; endDate: Date }): Promise<number> {
    const usersInPeriod = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });

    // Check which users had no activity before this period
    let newCount = 0;
    for (const user of usersInPeriod) {
      const priorActivity = await prisma.commandHistory.findFirst({
        where: {
          tenantId,
          userId: user.userId,
          timestamp: {
            lt: dateRange.startDate,
          },
        },
      });

      if (!priorActivity) {
        newCount++;
      }
    }

    return newCount;
  }

  /**
   * Get age distribution (mock data - would need actual customer demographics)
   */
  async getAgeDistribution(filter: AnalyticsFilter): Promise<DemographicData[]> {
    // Mock data - in production, this would come from customer records
    return [
      { category: '18-25', label: '18-25 tahun', count: 45, percentage: 15, averagePurchaseValue: 150000000 },
      { category: '26-35', label: '26-35 tahun', count: 120, percentage: 40, averagePurchaseValue: 220000000 },
      { category: '36-45', label: '36-45 tahun', count: 90, percentage: 30, averagePurchaseValue: 280000000 },
      { category: '46-55', label: '46-55 tahun', count: 30, percentage: 10, averagePurchaseValue: 350000000 },
      { category: '55+', label: '55+ tahun', count: 15, percentage: 5, averagePurchaseValue: 400000000 },
    ];
  }

  /**
   * Get location distribution
   */
  async getLocationDistribution(filter: AnalyticsFilter): Promise<DemographicData[]> {
    // Mock data - would come from customer records
    return [
      { category: 'jakarta', label: 'Jakarta', count: 150, percentage: 50 },
      { category: 'bekasi', label: 'Bekasi', count: 60, percentage: 20 },
      { category: 'tangerang', label: 'Tangerang', count: 45, percentage: 15 },
      { category: 'depok', label: 'Depok', count: 30, percentage: 10 },
      { category: 'bogor', label: 'Bogor', count: 15, percentage: 5 },
    ];
  }

  /**
   * Get income distribution
   */
  async getIncomeDistribution(filter: AnalyticsFilter): Promise<DemographicData[]> {
    // Mock data - would come from customer surveys/records
    return [
      { category: 'low', label: '< Rp 5 jt/bulan', count: 30, percentage: 10, averagePurchaseValue: 100000000 },
      { category: 'medium-low', label: 'Rp 5-10 jt/bulan', count: 90, percentage: 30, averagePurchaseValue: 150000000 },
      { category: 'medium', label: 'Rp 10-20 jt/bulan', count: 120, percentage: 40, averagePurchaseValue: 250000000 },
      { category: 'medium-high', label: 'Rp 20-50 jt/bulan', count: 45, percentage: 15, averagePurchaseValue: 400000000 },
      { category: 'high', label: '> Rp 50 jt/bulan', count: 15, percentage: 5, averagePurchaseValue: 700000000 },
    ];
  }

  /**
   * Get vehicle preferences
   */
  async getVehiclePreferences(filter: AnalyticsFilter): Promise<CustomerPreference[]> {
    const { tenantId, dateRange } = filter;

    // Get search and view activity
    const viewActivity = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        intent: {
          in: ['search_vehicle', 'view_vehicle'],
        },
        success: true,
      },
      select: {
        originalCommand: true,
        userId: true,
      },
    });

    // Extract make/model from commands (simplified)
    const preferences = new Map<string, { inquiries: number; users: Set<string>; purchases: number }>();

    viewActivity.forEach(cmd => {
      const command = cmd.originalCommand.toLowerCase();
      // Simple extraction (in production, would use entity extraction from command parser)
      const makes = ['toyota', 'honda', 'suzuki', 'daihatsu', 'mitsubishi'];
      makes.forEach(make => {
        if (command.includes(make)) {
          const key = make;
          if (!preferences.has(key)) {
            preferences.set(key, { inquiries: 0, users: new Set(), purchases: 0 });
          }
          const pref = preferences.get(key)!;
          pref.inquiries++;
          pref.users.add(cmd.userId);
        }
      });
    });

    // Get actual purchases by make
    const purchases = await prisma.vehicle.groupBy({
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
    });

    const purchaseMap = new Map(purchases.map(p => [p.make.toLowerCase(), p._count.id]));

    return Array.from(preferences.entries())
      .map(([make, data]) => {
        const purchaseCount = purchaseMap.get(make) || 0;
        const conversionRate = analyticsEngine.calculateConversionRate(purchaseCount, data.inquiries);

        return {
          make,
          model: '', // Aggregate at make level
          interestedCount: data.users.size,
          inquiryCount: data.inquiries,
          purchaseCount,
          conversionRate,
        };
      })
      .sort((a, b) => b.inquiryCount - a.inquiryCount)
      .slice(0, 10);
  }

  /**
   * Get customer behavior patterns
   */
  async getBehaviorPatterns(filter: AnalyticsFilter): Promise<CustomerBehavior> {
    const { tenantId, dateRange } = filter;

    // Get command activity
    const activity = await prisma.commandHistory.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        userId: true,
        intent: true,
        timestamp: true,
      },
    });

    // Group by user to analyze patterns
    const userActivity = new Map<string, any[]>();
    activity.forEach(cmd => {
      if (!userActivity.has(cmd.userId)) {
        userActivity.set(cmd.userId, []);
      }
      userActivity.get(cmd.userId)!.push(cmd);
    });

    // Calculate averages
    const inquiriesPerUser = Array.from(userActivity.values()).map(acts =>
      acts.filter(a => a.intent === 'search_vehicle' || a.intent === 'view_vehicle').length
    );

    const averageInquiriesBeforePurchase = analyticsEngine.calculateAverage(inquiriesPerUser);

    // Peak inquiry hours
    const hourCounts = new Map<number, number>();
    activity.forEach(cmd => {
      const hour = cmd.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const peakInquiryHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, inquiryCount: count }))
      .sort((a, b) => b.inquiryCount - a.inquiryCount)
      .slice(0, 5);

    return {
      averageInquiriesBeforePurchase,
      averageTestDrives: 1.5, // Mock
      preferredContactMethod: [
        { method: 'whatsapp', percentage: 60 },
        { method: 'phone', percentage: 25 },
        { method: 'email', percentage: 10 },
        { method: 'in_person', percentage: 5 },
      ],
      peakInquiryHours,
    };
  }

  /**
   * Get top customers by lifetime value
   */
  async getTopCustomers(filter: AnalyticsFilter): Promise<any[]> {
    const { tenantId, dateRange } = filter;

    const customerPurchases = await prisma.vehicle.groupBy({
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
    const userIds = customerPurchases.map(p => p.createdBy);
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
        email: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return customerPurchases
      .map(p => {
        const user = userMap.get(p.createdBy);
        return {
          userId: p.createdBy,
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          email: user?.email || '',
          totalPurchases: p._count.id,
          totalValue: p._sum.price || 0,
          averagePurchase: p._count.id > 0 ? (p._sum.price || 0) / p._count.id : 0,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20);
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();
