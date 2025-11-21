/**
 * Metrics Service
 * Main service for metrics collection, aggregation, and querying
 */

import {
  MetricSample,
  MetricsQueryRequest,
  MetricsQueryResponse,
  TenantMetrics,
  SystemMetrics,
  DatabaseMetrics,
  MetricsCollectionError
} from '../../types/health';
import { MetricsCollectorManager } from '../../lib/monitoring/collectors';
import { MetricsStorage, InMemoryMetricsStorage } from '../../lib/monitoring/storage';
import { SystemMetricsCollector, ApplicationMetricsCollector, DatabaseMetricsCollector, TenantMetricsCollector } from '../../lib/monitoring/collectors';

export interface MetricsServiceConfig {
  collectionInterval: number; // seconds
  retentionPeriod: number; // days
  enabledCollectors: string[];
  storageType: 'memory' | 'postgresql' | 'redis';
}

export class MetricsService {
  private collectorManager: MetricsCollectorManager;
  private storage: MetricsStorage;
  private isCollecting = false;

  constructor(
    private config: MetricsServiceConfig,
    storageInstance?: MetricsStorage,
    dbPool?: any
  ) {
    // Initialize storage
    if (storageInstance) {
      this.storage = storageInstance;
    } else {
      switch (config.storageType) {
        case 'postgresql':
          if (!dbPool) {
            throw new Error('Database pool required for PostgreSQL storage');
          }
          // Import dynamically to avoid circular dependencies
          const { PostgreSQLMetricsStorage } = require('../../lib/monitoring/storage');
          this.storage = new PostgreSQLMetricsStorage(dbPool);
          break;
        case 'redis':
          // Redis implementation would go here
          this.storage = new InMemoryMetricsStorage();
          break;
        default:
          this.storage = new InMemoryMetricsStorage();
      }
    }

    // Initialize collector manager
    this.collectorManager = new MetricsCollectorManager(this.storage);
    this.initializeCollectors();
  }

  /**
   * Initialize default metrics collectors
   */
  private initializeCollectors(): void {
    // System metrics collector
    if (this.config.enabledCollectors.includes('system')) {
      this.collectorManager.registerCollector(new SystemMetricsCollector());
    }

    // Application metrics collector
    if (this.config.enabledCollectors.includes('application')) {
      this.collectorManager.registerCollector(new ApplicationMetricsCollector());
    }

    // Database metrics collector
    if (this.config.enabledCollectors.includes('database')) {
      // Database collector would be initialized with actual DB pool
      // this.collectorManager.registerCollector(new DatabaseMetricsCollector(dbPool));
    }

    // Tenant metrics collector
    if (this.config.enabledCollectors.includes('tenant')) {
      // Tenant collector would be initialized with actual tenant service
      // this.collectorManager.registerCollector(new TenantMetricsCollector(tenantService));
    }
  }

  /**
   * Start metrics collection
   */
  async startCollection(): Promise<void> {
    if (this.isCollecting) {
      return;
    }

    try {
      // Initialize storage if needed
      if (this.config.storageType === 'postgresql') {
        await (this.storage as any).initializeMetricsTable?.();
      }

      // Start collection
      this.collectorManager.startCollection(this.config.collectionInterval * 1000);
      this.isCollecting = true;

      console.log(`Metrics collection started with ${this.config.collectionInterval}s interval`);
    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to start metrics collection: ${error.message}`,
        'metrics_service',
        error
      );
    }
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    this.collectorManager.stopCollection();
    this.isCollecting = false;
    console.log('Metrics collection stopped');
  }

  /**
   * Check if metrics collection is active
   */
  isActive(): boolean {
    return this.isCollecting && this.collectorManager.isCollecting();
  }

  /**
   * Collect metrics on demand
   */
  async collectMetrics(): Promise<MetricSample[]> {
    try {
      const metrics = await this.collectorManager.collectAllMetrics();

      // Store metrics if collection is not currently running
      if (!this.isCollecting && metrics.length > 0) {
        await this.storage.storeMetrics(metrics);
      }

      return metrics;
    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to collect metrics: ${error.message}`,
        'metrics_service',
        error
      );
    }
  }

  /**
   * Query metrics data
   */
  async queryMetrics(request: MetricsQueryRequest): Promise<MetricsQueryResponse> {
    try {
      return await this.storage.queryMetrics(request);
    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to query metrics: ${error.message}`,
        'metrics_service',
        error
      );
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics | null> {
    try {
      const systemCollector = this.collectorManager.getCollectors()
        .find(c => c.name === 'system') as SystemMetricsCollector;

      if (!systemCollector) {
        return null;
      }

      return await systemCollector.getDetailedSystemMetrics();
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return null;
    }
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics | null> {
    try {
      const dbCollector = this.collectorManager.getCollectors()
        .find(c => c.name === 'database') as DatabaseMetricsCollector;

      if (!dbCollector) {
        return null;
      }

      return await dbCollector.getDetailedDatabaseMetrics();
    } catch (error) {
      console.error('Failed to get database metrics:', error);
      return null;
    }
  }

  /**
   * Get tenant metrics
   */
  async getTenantMetrics(tenantId: string): Promise<TenantMetrics | null> {
    try {
      const tenantCollector = this.collectorManager.getCollectors()
        .find(c => c.name === 'tenant') as TenantMetricsCollector;

      if (!tenantCollector) {
        return null;
      }

      return await tenantCollector.getTenantMetrics(tenantId);
    } catch (error) {
      console.error(`Failed to get tenant metrics for ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Get metrics summary for dashboard
   */
  async getMetricsSummary(timeRange: { from: Date; to: Date }): Promise<{
    system: {
      cpu: { current: number; average: number; max: number };
      memory: { current: number; average: number; max: number };
      disk: { current: number; average: number; max: number };
    };
    application: {
      requests: { total: number; errors: number; avgResponseTime: number };
      uptime: number;
    };
    tenants: {
      active: number;
      totalUsers: number;
      activeUsers: number;
    };
    database: {
      connections: { active: number; total: number };
      queryPerformance: { avgDuration: number; slowQueries: number };
    };
  }> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get CPU metrics
      const cpuQuery = await this.queryMetrics({
        metric: 'system.cpu.usage',
        timeRange,
        aggregation: 'avg',
        interval: 300 // 5 minutes
      });

      // Get memory metrics
      const memoryQuery = await this.queryMetrics({
        metric: 'system.memory.usage',
        timeRange,
        aggregation: 'avg',
        interval: 300
      });

      // Get application metrics
      const appMetrics = await this.queryMetrics({
        metric: 'http.request.*',
        timeRange,
        aggregation: 'sum'
      });

      // Get tenant metrics
      const tenantMetrics = await this.queryMetrics({
        metric: 'tenants.active',
        timeRange,
        aggregation: 'avg'
      });

      // Calculate summary values
      const calculateStats = (values: number[]) => {
        if (values.length === 0) return { current: 0, average: 0, max: 0 };
        return {
          current: values[values.length - 1] || 0,
          average: values.reduce((sum, val) => sum + val, 0) / values.length,
          max: Math.max(...values)
        };
      };

      const cpuValues = cpuQuery.timeSeries.map(ts => ts.value);
      const memoryValues = memoryQuery.timeSeries.map(ts => ts.value);

      return {
        system: {
          cpu: calculateStats(cpuValues),
          memory: calculateStats(memoryValues),
          disk: calculateStats([]) // Would implement disk metrics
        },
        application: {
          requests: {
            total: 0, // Would calculate from HTTP metrics
            errors: 0,
            avgResponseTime: 0
          },
          uptime: process.uptime()
        },
        tenants: {
          active: tenantMetrics.timeSeries[tenantMetrics.timeSeries.length - 1]?.value || 0,
          totalUsers: 0, // Would get from user metrics
          activeUsers: 0
        },
        database: {
          connections: {
            active: 0, // Would get from database metrics
            total: 0
          },
          queryPerformance: {
            avgDuration: 0,
            slowQueries: 0
          }
        }
      };

    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      throw new MetricsCollectionError(
        `Failed to get metrics summary: ${error.message}`,
        'metrics_service',
        error
      );
    }
  }

  /**
   * Get metrics for specific time range
   */
  async getMetricsByTimeRange(
    metricName: string,
    from: Date,
    to: Date,
    filters?: Record<string, string>
  ): Promise<MetricSample[]> {
    try {
      return await this.storage.getMetricsByTimeRange(metricName, from, to, filters);
    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to get metrics by time range: ${error.message}`,
        'metrics_service',
        error
      );
    }
  }

  /**
   * Clean up old metrics
   */
  async cleanupOldMetrics(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod);

      const deletedCount = await this.storage.deleteOldMetrics(cutoffDate);
      console.log(`Cleaned up ${deletedCount} old metrics`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
      return 0;
    }
  }

  /**
   * Get available metrics
   */
  async getAvailableMetrics(): Promise<string[]> {
    try {
      // This would query the storage for available metric names
      // For now, return common metrics
      return [
        'system.cpu.usage',
        'system.memory.usage',
        'system.memory.free',
        'system.memory.total',
        'database.connections.active',
        'database.connections.total',
        'http.request.get.*',
        'http.request.post.*',
        'tenants.active',
        'users.active',
        'users.total'
      ];
    } catch (error) {
      console.error('Failed to get available metrics:', error);
      return [];
    }
  }

  /**
   * Get collector status
   */
  getCollectorStatus(): Array<{
    name: string;
    enabled: boolean;
    collecting: boolean;
    lastCollection?: Date;
    error?: string;
  }> {
    return this.collectorManager.getCollectors().map(collector => ({
      name: collector.name,
      enabled: collector.isEnabled(),
      collecting: this.collectorManager.isCollecting(),
      lastCollection: new Date(), // Would track actual collection time
      error: undefined // Would track collection errors
    }));
  }

  /**
   * Record custom metric
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    tenantId?: string
  ): void {
    const metric: MetricSample = {
      id: `${name}_${Date.now()}_${Math.random()}`,
      metricName: name,
      value,
      timestamp: new Date(),
      tags,
      tenantId,
      source: 'custom'
    };

    // Store immediately if not collecting
    if (!this.isCollecting) {
      this.storage.storeMetrics([metric]).catch(error => {
        console.error('Failed to store custom metric:', error);
      });
    }
  }

  /**
   * Increment counter metric
   */
  incrementCounter(
    name: string,
    value: number = 1,
    tags: Record<string, string> = {},
    tenantId?: string
  ): void {
    this.recordMetric(`${name}.count`, value, tags, tenantId);
  }

  /**
   * Record timing metric
   */
  recordTiming(
    name: string,
    duration: number,
    tags: Record<string, string> = {},
    tenantId?: string
  ): void {
    this.recordMetric(`${name}.duration`, duration, tags, tenantId);
  }

  /**
   * Get service configuration
   */
  getConfig(): MetricsServiceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MetricsServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart collection if interval changed
    if (this.isCollecting && newConfig.collectionInterval) {
      this.stopCollection();
      this.startCollection();
    }
  }
}