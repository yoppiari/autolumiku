import { createLogger, format, transports } from 'winston';
import { tenantDatabasePool } from '@/lib/database/tenant-pool';
import { TenantResourceMetrics, TenantIsolationConfig } from './index';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export interface PerformanceMetrics {
  tenantId: string;
  timestamp: Date;
  queryMetrics: {
    totalQueries: number;
    slowQueries: number; // queries > queryTimeout
    failedQueries: number;
    avgResponseTime: number; // milliseconds
    p95ResponseTime: number; // 95th percentile
    p99ResponseTime: number; // 99th percentile
  };
  resourceMetrics: {
    cpuUsage: number; // percentage
    memoryUsage: number; // MB
    diskIO: number; // operations per second
    networkIO: number; // MB per second
  };
  throttlingMetrics: {
    throttledRequests: number;
    throttlingReason: string[];
  };
}

export interface ThrottlingRule {
  tenantId: string;
  ruleType: 'query_rate' | 'concurrent_queries' | 'resource_usage' | 'error_rate';
  threshold: number;
  currentValue: number;
  action: 'warn' | 'throttle' | 'block';
  timestamp: Date;
}

/**
 * Performance Monitor and Throttling Service
 *
 * Monitors tenant resource usage and applies performance throttling
 * to ensure fair resource allocation and prevent abuse.
 */
export class PerformanceMonitorService {
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private activeThrottles: Map<string, ThrottlingRule[]> = new Map();
  private queryTracking: Map<string, { startTime: number; query: string }[]> = new Map();

  private readonly HISTORY_RETENTION_HOURS = 24;
  private readonly METRICS_SAMPLE_INTERVAL = 60000; // 1 minute

  constructor() {
    // Start performance monitoring
    this.startPerformanceMonitoring();

    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  /**
   * Track query execution for performance monitoring
   */
  async trackQuery<T>(
    tenantId: string,
    query: string,
    executor: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    // Track active query
    if (!this.queryTracking.has(tenantId)) {
      this.queryTracking.set(tenantId, []);
    }
    const tracking = { startTime, query };
    this.queryTracking.get(tenantId)!.push(tracking);

    try {
      const result = await executor();
      const executionTime = Date.now() - startTime;

      // Log slow queries
      if (executionTime > 1000) { // 1 second threshold
        logger.warn('Slow query detected', {
          tenantId,
          executionTime,
          query: query.substring(0, 200) // Log first 200 chars
        });
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution failed', {
        tenantId,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;

    } finally {
      // Remove from tracking
      const queries = this.queryTracking.get(tenantId)!;
      const index = queries.findIndex(q => q === tracking);
      if (index > -1) {
        queries.splice(index, 1);
      }
    }
  }

  /**
   * Check if tenant should be throttled
   */
  async shouldThrottle(
    tenantId: string,
    config: TenantIsolationConfig
  ): Promise<{ throttle: boolean; reason?: string; rule?: ThrottlingRule }> {
    if (!config.enablePerformanceThrottling) {
      return { throttle: false };
    }

    const activeRules = this.activeThrottles.get(tenantId) || [];

    // Check for blocking rules
    const blockingRule = activeRules.find(r => r.action === 'block');
    if (blockingRule) {
      return {
        throttle: true,
        reason: `Blocked due to ${blockingRule.ruleType}`,
        rule: blockingRule
      };
    }

    // Check for throttling rules
    const throttlingRule = activeRules.find(r => r.action === 'throttle');
    if (throttlingRule) {
      // Apply rate limiting delay
      await this.applyThrottleDelay(throttlingRule);
      return {
        throttle: true,
        reason: `Throttled due to ${throttlingRule.ruleType}`,
        rule: throttlingRule
      };
    }

    // Check current resource usage
    const currentQueries = this.queryTracking.get(tenantId)?.length || 0;
    if (currentQueries >= config.maxConcurrentQueries) {
      const rule: ThrottlingRule = {
        tenantId,
        ruleType: 'concurrent_queries',
        threshold: config.maxConcurrentQueries,
        currentValue: currentQueries,
        action: 'throttle',
        timestamp: new Date()
      };

      this.addThrottlingRule(tenantId, rule);

      return {
        throttle: true,
        reason: 'Maximum concurrent queries exceeded',
        rule
      };
    }

    return { throttle: false };
  }

  /**
   * Apply throttle delay based on rule
   */
  private async applyThrottleDelay(rule: ThrottlingRule): Promise<void> {
    // Calculate delay based on how much threshold is exceeded
    const excessPercentage = (rule.currentValue - rule.threshold) / rule.threshold;
    const baseDelay = 100; // 100ms
    const delay = Math.min(baseDelay * (1 + excessPercentage), 5000); // Max 5 seconds

    await new Promise(resolve => setTimeout(resolve, delay));

    logger.debug('Applied throttle delay', {
      tenantId: rule.tenantId,
      delay,
      ruleType: rule.ruleType
    });
  }

  /**
   * Add throttling rule for tenant
   */
  private addThrottlingRule(tenantId: string, rule: ThrottlingRule): void {
    if (!this.activeThrottles.has(tenantId)) {
      this.activeThrottles.set(tenantId, []);
    }

    const rules = this.activeThrottles.get(tenantId)!;

    // Remove old rule of same type
    const existingIndex = rules.findIndex(r => r.ruleType === rule.ruleType);
    if (existingIndex > -1) {
      rules.splice(existingIndex, 1);
    }

    rules.push(rule);

    logger.info('Throttling rule added', {
      tenantId: rule.tenantId,
      ruleType: rule.ruleType,
      action: rule.action
    });
  }

  /**
   * Remove throttling rule for tenant
   */
  removeThrottlingRule(tenantId: string, ruleType: ThrottlingRule['ruleType']): void {
    const rules = this.activeThrottles.get(tenantId);
    if (!rules) return;

    const index = rules.findIndex(r => r.ruleType === ruleType);
    if (index > -1) {
      rules.splice(index, 1);
      logger.info('Throttling rule removed', { tenantId, ruleType });
    }
  }

  /**
   * Get active throttling rules for tenant
   */
  getActiveThrottles(tenantId: string): ThrottlingRule[] {
    return this.activeThrottles.get(tenantId) || [];
  }

  /**
   * Get performance metrics for tenant
   */
  getPerformanceMetrics(
    tenantId: string,
    options?: {
      since?: Date;
      limit?: number;
    }
  ): PerformanceMetrics[] {
    let metrics = this.performanceHistory.get(tenantId) || [];

    if (options?.since) {
      metrics = metrics.filter(m => m.timestamp >= options.since!);
    }

    if (options?.limit) {
      metrics = metrics.slice(-options.limit);
    }

    return metrics;
  }

  /**
   * Get current performance status
   */
  async getCurrentPerformanceStatus(tenantId: string): Promise<{
    status: 'optimal' | 'degraded' | 'critical';
    metrics: {
      activeQueries: number;
      avgResponseTime: number;
      recentErrors: number;
      throttlingActive: boolean;
    };
    recommendations: string[];
  }> {
    const activeQueries = this.queryTracking.get(tenantId)?.length || 0;
    const recentMetrics = this.getPerformanceMetrics(tenantId, {
      since: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    });

    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.queryMetrics.avgResponseTime, 0) / recentMetrics.length
      : 0;

    const recentErrors = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.queryMetrics.failedQueries, 0)
      : 0;

    const throttlingActive = (this.activeThrottles.get(tenantId)?.length || 0) > 0;

    // Determine status
    let status: 'optimal' | 'degraded' | 'critical' = 'optimal';
    const recommendations: string[] = [];

    if (avgResponseTime > 2000) {
      status = 'critical';
      recommendations.push('Query response time is critically high. Consider optimizing database queries.');
    } else if (avgResponseTime > 1000) {
      status = 'degraded';
      recommendations.push('Query response time is elevated. Monitor for continued degradation.');
    }

    if (recentErrors > 10) {
      status = 'critical';
      recommendations.push('High error rate detected. Investigate failed queries and database connectivity.');
    } else if (recentErrors > 5) {
      if (status !== 'critical') status = 'degraded';
      recommendations.push('Increased error rate. Monitor for patterns.');
    }

    if (throttlingActive) {
      if (status === 'optimal') status = 'degraded';
      recommendations.push('Performance throttling is active. Reduce query load or increase resource limits.');
    }

    if (activeQueries > 8) {
      if (status === 'optimal') status = 'degraded';
      recommendations.push('High number of concurrent queries. Consider connection pooling optimization.');
    }

    return {
      status,
      metrics: {
        activeQueries,
        avgResponseTime,
        recentErrors,
        throttlingActive
      },
      recommendations
    };
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(async () => {
      try {
        const poolStats = tenantDatabasePool.getPoolStats();

        for (const [tenantId, stats] of Object.entries(poolStats)) {
          const metrics = await this.collectPerformanceMetrics(tenantId, stats);
          this.storePerformanceMetrics(tenantId, metrics);

          // Check for performance issues and apply throttling if needed
          await this.evaluatePerformanceThresholds(tenantId, metrics);
        }
      } catch (error) {
        logger.error('Error in performance monitoring:', error);
      }
    }, this.METRICS_SAMPLE_INTERVAL);
  }

  /**
   * Collect performance metrics for tenant
   */
  private async collectPerformanceMetrics(
    tenantId: string,
    poolStats: any
  ): Promise<PerformanceMetrics> {
    const activeQueries = this.queryTracking.get(tenantId) || [];

    // Calculate query metrics (simplified - in production would use actual query logs)
    const queryMetrics = {
      totalQueries: activeQueries.length,
      slowQueries: activeQueries.filter(q => Date.now() - q.startTime > 1000).length,
      failedQueries: 0, // Would be tracked from actual query execution
      avgResponseTime: 0, // Would be calculated from query logs
      p95ResponseTime: 0,
      p99ResponseTime: 0
    };

    // Resource metrics (simplified - in production would use system monitoring)
    const resourceMetrics = {
      cpuUsage: 0, // Would come from system metrics
      memoryUsage: 0, // Would come from system metrics
      diskIO: 0, // Would come from system metrics
      networkIO: 0 // Would come from system metrics
    };

    // Throttling metrics
    const activeThrottles = this.activeThrottles.get(tenantId) || [];
    const throttlingMetrics = {
      throttledRequests: activeThrottles.filter(r => r.action === 'throttle').length,
      throttlingReason: activeThrottles.map(r => `${r.ruleType} (${r.action})`)
    };

    return {
      tenantId,
      timestamp: new Date(),
      queryMetrics,
      resourceMetrics,
      throttlingMetrics
    };
  }

  /**
   * Store performance metrics
   */
  private storePerformanceMetrics(tenantId: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(tenantId)) {
      this.performanceHistory.set(tenantId, []);
    }

    this.performanceHistory.get(tenantId)!.push(metrics);
  }

  /**
   * Evaluate performance thresholds and apply throttling
   */
  private async evaluatePerformanceThresholds(
    tenantId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    // Check query rate
    if (metrics.queryMetrics.totalQueries > 50) {
      this.addThrottlingRule(tenantId, {
        tenantId,
        ruleType: 'concurrent_queries',
        threshold: 50,
        currentValue: metrics.queryMetrics.totalQueries,
        action: 'throttle',
        timestamp: new Date()
      });
    }

    // Check error rate
    const errorRate = metrics.queryMetrics.failedQueries / Math.max(metrics.queryMetrics.totalQueries, 1);
    if (errorRate > 0.1) { // 10% error rate
      this.addThrottlingRule(tenantId, {
        tenantId,
        ruleType: 'error_rate',
        threshold: 0.1,
        currentValue: errorRate,
        action: 'warn',
        timestamp: new Date()
      });
    }

    // Check resource usage
    if (metrics.resourceMetrics.cpuUsage > 80) {
      this.addThrottlingRule(tenantId, {
        tenantId,
        ruleType: 'resource_usage',
        threshold: 80,
        currentValue: metrics.resourceMetrics.cpuUsage,
        action: 'throttle',
        timestamp: new Date()
      });
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.HISTORY_RETENTION_HOURS);

    for (const [tenantId, metrics] of this.performanceHistory.entries()) {
      const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
      this.performanceHistory.set(tenantId, recentMetrics);
    }

    // Clean up old throttling rules (older than 1 hour)
    const throttleCutoff = new Date();
    throttleCutoff.setHours(throttleCutoff.getHours() - 1);

    for (const [tenantId, rules] of this.activeThrottles.entries()) {
      const activeRules = rules.filter(r => r.timestamp >= throttleCutoff);
      this.activeThrottles.set(tenantId, activeRules);
    }

    logger.info('Cleaned up old performance metrics and throttling rules');
  }

  /**
   * Generate performance report for tenant
   */
  generatePerformanceReport(
    tenantId: string,
    periodHours: number = 24
  ): {
    period: { start: Date; end: Date };
    summary: {
      totalQueries: number;
      slowQueries: number;
      failedQueries: number;
      avgResponseTime: number;
      peakConcurrentQueries: number;
      throttlingEvents: number;
    };
    trends: {
      queryTrend: 'increasing' | 'stable' | 'decreasing';
      performanceTrend: 'improving' | 'stable' | 'degrading';
    };
    recommendations: string[];
  } {
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - periodHours);

    const metrics = this.getPerformanceMetrics(tenantId, { since: start });

    if (metrics.length === 0) {
      return {
        period: { start, end },
        summary: {
          totalQueries: 0,
          slowQueries: 0,
          failedQueries: 0,
          avgResponseTime: 0,
          peakConcurrentQueries: 0,
          throttlingEvents: 0
        },
        trends: {
          queryTrend: 'stable',
          performanceTrend: 'stable'
        },
        recommendations: ['Insufficient data for analysis']
      };
    }

    // Calculate summary
    const summary = {
      totalQueries: metrics.reduce((sum, m) => sum + m.queryMetrics.totalQueries, 0),
      slowQueries: metrics.reduce((sum, m) => sum + m.queryMetrics.slowQueries, 0),
      failedQueries: metrics.reduce((sum, m) => sum + m.queryMetrics.failedQueries, 0),
      avgResponseTime: metrics.reduce((sum, m) => sum + m.queryMetrics.avgResponseTime, 0) / metrics.length,
      peakConcurrentQueries: Math.max(...metrics.map(m => m.queryMetrics.totalQueries)),
      throttlingEvents: metrics.reduce((sum, m) => sum + m.throttlingMetrics.throttledRequests, 0)
    };

    // Calculate trends
    const halfPoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, halfPoint);
    const secondHalf = metrics.slice(halfPoint);

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.queryMetrics.totalQueries, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.queryMetrics.totalQueries, 0) / secondHalf.length;
    const queryTrend = secondHalfAvg > firstHalfAvg * 1.1 ? 'increasing' :
                      secondHalfAvg < firstHalfAvg * 0.9 ? 'decreasing' : 'stable';

    const firstHalfPerf = firstHalf.reduce((sum, m) => sum + m.queryMetrics.avgResponseTime, 0) / firstHalf.length;
    const secondHalfPerf = secondHalf.reduce((sum, m) => sum + m.queryMetrics.avgResponseTime, 0) / secondHalf.length;
    const performanceTrend = secondHalfPerf < firstHalfPerf * 0.9 ? 'improving' :
                            secondHalfPerf > firstHalfPerf * 1.1 ? 'degrading' : 'stable';

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.slowQueries / summary.totalQueries > 0.1) {
      recommendations.push('High percentage of slow queries. Review and optimize query patterns.');
    }

    if (summary.failedQueries / summary.totalQueries > 0.05) {
      recommendations.push('Elevated error rate. Investigate database connectivity and query failures.');
    }

    if (summary.throttlingEvents > 0) {
      recommendations.push(`Performance throttling occurred ${summary.throttlingEvents} times. Consider increasing resource allocation.`);
    }

    if (queryTrend === 'increasing' && performanceTrend === 'degrading') {
      recommendations.push('Query load is increasing while performance is degrading. Consider scaling resources or optimizing queries.');
    }

    if (summary.peakConcurrentQueries > 40) {
      recommendations.push('High peak concurrent queries. Consider implementing query batching or caching.');
    }

    return {
      period: { start, end },
      summary,
      trends: {
        queryTrend,
        performanceTrend
      },
      recommendations: recommendations.length > 0 ? recommendations : ['System performance is healthy']
    };
  }
}

export const performanceMonitorService = new PerformanceMonitorService();
export default PerformanceMonitorService;
