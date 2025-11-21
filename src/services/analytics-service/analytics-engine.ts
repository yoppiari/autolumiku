/**
 * Analytics Engine
 * Epic 7: Core analytics calculation and orchestration
 *
 * Central engine that coordinates all analytics calculations,
 * manages caching, and provides unified interface.
 */

import {
  AnalyticsFilter,
  DateRange,
  TimePeriod,
  ComparisonPeriod,
  MetricValue,
  TrendDirection,
  DashboardOverview,
} from './types';

export class AnalyticsEngine {
  /**
   * Convert time period to date range
   */
  getDateRangeFromPeriod(period: TimePeriod, customRange?: DateRange): DateRange {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'custom':
        if (!customRange) {
          throw new Error('Custom range requires startDate and endDate');
        }
        return customRange;

      default:
        throw new Error(`Unknown period: ${period}`);
    }

    return {
      startDate,
      endDate: now,
    };
  }

  /**
   * Get comparison period date range
   */
  getComparisonDateRange(
    dateRange: DateRange,
    comparisonPeriod: ComparisonPeriod
  ): DateRange | null {
    if (comparisonPeriod === 'none') {
      return null;
    }

    const duration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const comparisonEnd = new Date(dateRange.startDate);

    if (comparisonPeriod === 'previous') {
      // Previous period of same duration
      const comparisonStart = new Date(comparisonEnd.getTime() - duration);
      return {
        startDate: comparisonStart,
        endDate: comparisonEnd,
      };
    }

    if (comparisonPeriod === 'last_year') {
      // Same period last year
      const comparisonStart = new Date(dateRange.startDate);
      comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
      const comparisonEndDate = new Date(dateRange.endDate);
      comparisonEndDate.setFullYear(comparisonEndDate.getFullYear() - 1);
      return {
        startDate: comparisonStart,
        endDate: comparisonEndDate,
      };
    }

    return null;
  }

  /**
   * Calculate metric value with comparison
   */
  calculateMetricValue(
    current: number,
    previous?: number
  ): MetricValue {
    if (previous === undefined || previous === null) {
      return {
        current,
        trend: 'neutral',
      };
    }

    const changeAbsolute = current - previous;
    const changePercent = previous === 0 ? 0 : (changeAbsolute / previous) * 100;

    let trend: TrendDirection = 'neutral';
    if (changePercent > 0.5) trend = 'up';
    else if (changePercent < -0.5) trend = 'down';

    return {
      current,
      previous,
      trend,
      changePercent: Math.round(changePercent * 10) / 10,
      changeAbsolute,
    };
  }

  /**
   * Calculate percentage
   */
  calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 10) / 10;
  }

  /**
   * Calculate average
   */
  calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * Calculate median
   */
  calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Calculate conversion rate
   */
  calculateConversionRate(conversions: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((conversions / total) * 100 * 10) / 10;
  }

  /**
   * Format currency (Indonesian Rupiah)
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format number with thousand separators
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value);
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Format duration (seconds to human readable)
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * Group data by period (day, week, month)
   */
  groupByPeriod(
    data: Array<{ date: Date; value: number }>,
    grouping: 'day' | 'week' | 'month' | 'year'
  ): Array<{ period: string; value: number; count: number }> {
    const grouped = new Map<string, { value: number; count: number }>();

    data.forEach(({ date, value }) => {
      let key: string;

      switch (grouping) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { value: 0, count: 0 });
      }

      const entry = grouped.get(key)!;
      entry.value += value;
      entry.count += 1;
    });

    return Array.from(grouped.entries())
      .map(([period, { value, count }]) => ({ period, value, count }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate growth rate between two periods
   */
  calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(
    values: number[],
    windowSize: number
  ): number[] {
    if (values.length < windowSize) return values;

    const result: number[] = [];

    for (let i = 0; i <= values.length - windowSize; i++) {
      const window = values.slice(i, i + windowSize);
      const average = this.calculateAverage(window);
      result.push(average);
    }

    return result;
  }

  /**
   * Predict next value using simple linear regression
   */
  predictNextValue(values: number[]): number {
    if (values.length < 2) return values[0] || 0;

    // Simple linear regression
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next value (x = n)
    return Math.round((slope * n + intercept) * 100) / 100;
  }

  /**
   * Detect anomalies in time series data
   */
  detectAnomalies(
    values: number[],
    threshold: number = 2 // Standard deviations
  ): number[] {
    if (values.length < 3) return [];

    const mean = this.calculateAverage(values);
    const variance = this.calculateAverage(
      values.map(v => Math.pow(v - mean, 2))
    );
    const stdDev = Math.sqrt(variance);

    const anomalyIndices: number[] = [];

    values.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      if (zScore > threshold) {
        anomalyIndices.push(index);
      }
    });

    return anomalyIndices;
  }

  /**
   * Calculate confidence interval for predictions
   */
  calculateConfidenceInterval(
    values: number[],
    confidence: number = 0.95
  ): { low: number; high: number } {
    const mean = this.calculateAverage(values);
    const variance = this.calculateAverage(
      values.map(v => Math.pow(v - mean, 2))
    );
    const stdDev = Math.sqrt(variance);

    // Z-score for 95% confidence ≈ 1.96
    const zScore = confidence === 0.95 ? 1.96 : 2.58; // 99% = 2.58

    const margin = zScore * (stdDev / Math.sqrt(values.length));

    return {
      low: Math.round((mean - margin) * 100) / 100,
      high: Math.round((mean + margin) * 100) / 100,
    };
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    if (Number.isInteger(index)) {
      return sorted[index];
    }

    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Generate period labels for charts
   */
  generatePeriodLabels(
    dateRange: DateRange,
    grouping: 'day' | 'week' | 'month'
  ): string[] {
    const labels: string[] = [];
    const current = new Date(dateRange.startDate);

    while (current <= dateRange.endDate) {
      switch (grouping) {
        case 'day':
          labels.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          labels.push(`W${this.getWeekNumber(current)}-${current.getFullYear()}`);
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          labels.push(
            `${current.toLocaleString('id-ID', { month: 'short' })} ${current.getFullYear()}`
          );
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return labels;
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Validate filter parameters
   */
  validateFilter(filter: AnalyticsFilter): void {
    if (!filter.tenantId) {
      throw new Error('tenantId is required');
    }

    if (!filter.dateRange || !filter.dateRange.startDate || !filter.dateRange.endDate) {
      throw new Error('Valid date range is required');
    }

    if (filter.dateRange.startDate > filter.dateRange.endDate) {
      throw new Error('startDate must be before endDate');
    }

    const daysDiff =
      (filter.dateRange.endDate.getTime() - filter.dateRange.startDate.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysDiff > 730) {
      // Max 2 years
      throw new Error('Date range cannot exceed 2 years');
    }
  }
}

export const analyticsEngine = new AnalyticsEngine();
