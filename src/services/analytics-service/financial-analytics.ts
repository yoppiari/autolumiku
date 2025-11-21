/**
 * Financial Analytics Service
 * Epic 7: Story 7.6 - Financial Performance & Revenue Analytics
 */

import { prisma } from '@/lib/prisma';
import {
  AnalyticsFilter,
  FinancialAnalytics,
  FinancialMetrics,
  RevenueBreakdown,
  ExpenseCategory,
  CashFlow,
  RevenueForecas,
  ChartDataPoint,
} from './types';
import { analyticsEngine } from './analytics-engine';

export class FinancialAnalyticsService {
  /**
   * Get complete financial analytics
   */
  async getFinancialAnalytics(filter: AnalyticsFilter): Promise<FinancialAnalytics> {
    analyticsEngine.validateFilter(filter);

    const [metrics, revenueByPeriod, revenueBreakdown, expenseBreakdown, cashFlowAnalysis, profitTrend, forecast] =
      await Promise.all([
        this.getFinancialMetrics(filter),
        this.getRevenueByPeriod(filter),
        this.getRevenueBreakdown(filter),
        this.getExpenseBreakdown(filter),
        this.getCashFlowAnalysis(filter),
        this.getProfitTrend(filter),
        this.getRevenueForecast(filter),
      ]);

    return {
      metrics,
      revenueByPeriod,
      revenueBreakdown,
      expenseBreakdown,
      cashFlowAnalysis,
      profitTrend,
      forecast,
    };
  }

  /**
   * Get financial metrics
   */
  async getFinancialMetrics(filter: AnalyticsFilter): Promise<FinancialMetrics> {
    const { tenantId, dateRange, comparisonPeriod = 'previous' } = filter;

    // Get revenue (from vehicle sales)
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
        price: true,
      },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + s.price, 0);

    // Estimate costs (mock - would need actual cost tracking)
    // Assume 80% of sale price as vehicle cost
    const totalCost = totalRevenue * 0.80;
    const grossProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Operating expenses (mock - would come from expense records)
    const operatingExpenses = totalRevenue * 0.10; // 10% of revenue

    // Net profit
    const netProfit = grossProfit - operatingExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Get comparison data
    let previousMetrics: any = {};
    if (comparisonPeriod !== 'none') {
      const comparisonRange = analyticsEngine.getComparisonDateRange(dateRange, comparisonPeriod);
      if (comparisonRange) {
        const prevSales = await prisma.vehicle.findMany({
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

        const prevRevenue = prevSales.reduce((sum, s) => sum + s.price, 0);
        const prevCost = prevRevenue * 0.80;
        const prevGrossProfit = prevRevenue - prevCost;

        previousMetrics = {
          totalRevenue: prevRevenue,
          grossProfit: prevGrossProfit,
        };
      }
    }

    return {
      totalRevenue: analyticsEngine.calculateMetricValue(totalRevenue, previousMetrics.totalRevenue),
      grossProfit: analyticsEngine.calculateMetricValue(grossProfit, previousMetrics.grossProfit),
      grossMargin: analyticsEngine.calculateMetricValue(grossMargin),
      netProfit: analyticsEngine.calculateMetricValue(netProfit),
      operatingExpenses: analyticsEngine.calculateMetricValue(operatingExpenses),
      profitMargin: analyticsEngine.calculateMetricValue(profitMargin),
    };
  }

  /**
   * Get revenue by period
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
   * Get revenue breakdown by category
   */
  async getRevenueBreakdown(filter: AnalyticsFilter): Promise<RevenueBreakdown[]> {
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
      _sum: {
        price: true,
      },
      _count: {
        id: true,
      },
    });

    const totalRevenue = salesByMake.reduce((sum, s) => sum + (s._sum.price || 0), 0);

    return salesByMake.map(s => {
      const revenue = s._sum.price || 0;
      const cost = revenue * 0.80; // 80% cost estimate
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        category: s.make,
        revenue,
        cost,
        profit,
        margin,
        percentOfTotal: analyticsEngine.calculatePercentage(revenue, totalRevenue),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get expense breakdown (mock data - would need actual expense tracking)
   */
  async getExpenseBreakdown(filter: AnalyticsFilter): Promise<ExpenseCategory[]> {
    const { tenantId, dateRange } = filter;

    // Get total revenue to calculate expense percentages
    const sales = await prisma.vehicle.aggregate({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: {
        price: true,
      },
    });

    const totalRevenue = sales._sum.price || 0;

    // Mock expense data (in production, would come from expense records)
    const expenses = [
      { category: 'marketing' as const, label: 'Marketing & Advertising', percentage: 3 },
      { category: 'operations' as const, label: 'Operations', percentage: 2 },
      { category: 'salaries' as const, label: 'Salaries & Wages', percentage: 4 },
      { category: 'rent' as const, label: 'Rent & Utilities', percentage: 1 },
      { category: 'utilities' as const, label: 'Other Utilities', percentage: 0.5 },
      { category: 'other' as const, label: 'Other Expenses', percentage: 1.5 },
    ];

    const totalExpenses = expenses.reduce((sum, e) => sum + (totalRevenue * e.percentage / 100), 0);

    return expenses.map(e => {
      const amount = totalRevenue * (e.percentage / 100);
      return {
        category: e.category,
        label: e.label,
        amount,
        percentOfTotal: analyticsEngine.calculatePercentage(amount, totalExpenses),
        trend: 'neutral' as const,
      };
    });
  }

  /**
   * Get cash flow analysis
   */
  async getCashFlowAnalysis(filter: AnalyticsFilter): Promise<CashFlow[]> {
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

    return grouped.map(g => {
      const cashIn = g.value;
      const cashOut = g.value * 0.90; // 90% of revenue as expenses (cost + operating)
      const netCashFlow = cashIn - cashOut;

      return {
        period: g.period,
        cashIn,
        cashOut,
        netCashFlow,
      };
    });
  }

  /**
   * Get profit trend
   */
  async getProfitTrend(filter: AnalyticsFilter): Promise<ChartDataPoint[]> {
    const cashFlow = await this.getCashFlowAnalysis(filter);

    return cashFlow.map(cf => ({
      date: cf.period,
      value: cf.netCashFlow,
      label: analyticsEngine.formatCurrency(cf.netCashFlow),
    }));
  }

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(filter: AnalyticsFilter): Promise<RevenueForecas[]> {
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

    const monthlyRevenues = grouped.map(g => g.value);

    // Predict next 3 months
    const forecasts: RevenueForecas[] = [];
    const lastMonth = grouped[grouped.length - 1]?.period || '';

    for (let i = 1; i <= 3; i++) {
      const predictedRevenue = analyticsEngine.predictNextValue(monthlyRevenues);
      const confidence = analyticsEngine.calculateConfidenceInterval(monthlyRevenues);

      // Calculate next month period
      const lastDate = new Date(lastMonth + '-01');
      lastDate.setMonth(lastDate.getMonth() + i);
      const nextPeriod = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

      forecasts.push({
        period: nextPeriod,
        predictedRevenue: Math.max(0, predictedRevenue),
        confidenceRange: {
          low: Math.max(0, confidence.low),
          high: confidence.high,
        },
        basedOnTrend: monthlyRevenues.length >= 3,
      });
    }

    return forecasts;
  }
}

export const financialAnalyticsService = new FinancialAnalyticsService();
