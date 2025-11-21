/**
 * Metrics Collectors
 * Collection of metrics collectors for system, database, and application monitoring
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';
import { SystemMetrics, DatabaseMetrics, TenantMetrics, MetricSample, MetricsCollectionError } from '../../types/health';

const execAsync = promisify(exec);

export interface MetricsCollector {
  name: string;
  collect(): Promise<MetricSample[]>;
  isEnabled(): boolean;
}

/**
 * System Metrics Collector
 * Collects CPU, memory, disk, and network metrics
 */
export class SystemMetricsCollector implements MetricsCollector {
  name = 'system';

  isEnabled(): boolean {
    return process.env.NODE_ENV !== 'test';
  }

  async collect(): Promise<MetricSample[]> {
    try {
      const timestamp = new Date();
      const metrics: MetricSample[] = [];

      // CPU Metrics
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      metrics.push({
        id: `cpu_usage_${timestamp.getTime()}`,
        metricName: 'system.cpu.usage',
        value: cpuPercent,
        timestamp,
        tags: { source: 'node' },
        source: 'system'
      });

      const loadAvg = os.loadavg();
      metrics.push({
        id: `cpu_load1_${timestamp.getTime()}`,
        metricName: 'system.cpu.load_1m',
        value: loadAvg[0],
        timestamp,
        tags: { source: 'node', period: '1m' },
        source: 'system'
      });

      metrics.push({
        id: `cpu_load5_${timestamp.getTime()}`,
        metricName: 'system.cpu.load_5m',
        value: loadAvg[1],
        timestamp,
        tags: { source: 'node', period: '5m' },
        source: 'system'
      });

      metrics.push({
        id: `cpu_load15_${timestamp.getTime()}`,
        metricName: 'system.cpu.load_15m',
        value: loadAvg[2],
        timestamp,
        tags: { source: 'node', period: '15m' },
        source: 'system'
      });

      // Memory Metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = (usedMem / totalMem) * 100;

      metrics.push({
        id: `mem_total_${timestamp.getTime()}`,
        metricName: 'system.memory.total',
        value: totalMem,
        timestamp,
        tags: { source: 'node', unit: 'bytes' },
        source: 'system'
      });

      metrics.push({
        id: `mem_used_${timestamp.getTime()}`,
        metricName: 'system.memory.used',
        value: usedMem,
        timestamp,
        tags: { source: 'node', unit: 'bytes' },
        source: 'system'
      });

      metrics.push({
        id: `mem_free_${timestamp.getTime()}`,
        metricName: 'system.memory.free',
        value: freeMem,
        timestamp,
        tags: { source: 'node', unit: 'bytes' },
        source: 'system'
      });

      metrics.push({
        id: `mem_usage_${timestamp.getTime()}`,
        metricName: 'system.memory.usage',
        value: memUsage,
        timestamp,
        tags: { source: 'node', unit: 'percent' },
        source: 'system'
      });

      // Process Memory
      const processMem = process.memoryUsage();
      metrics.push({
        id: `process_rss_${timestamp.getTime()}`,
        metricName: 'process.memory.rss',
        value: processMem.rss,
        timestamp,
        tags: { source: 'node', unit: 'bytes', pid: String(process.pid) },
        source: 'system'
      });

      metrics.push({
        id: `process_heap_used_${timestamp.getTime()}`,
        metricName: 'process.memory.heap_used',
        value: processMem.heapUsed,
        timestamp,
        tags: { source: 'node', unit: 'bytes', pid: String(process.pid) },
        source: 'system'
      });

      metrics.push({
        id: `process_heap_total_${timestamp.getTime()}`,
        metricName: 'process.memory.heap_total',
        value: processMem.heapTotal,
        timestamp,
        tags: { source: 'node', unit: 'bytes', pid: String(process.pid) },
        source: 'system'
      });

      // Uptime
      metrics.push({
        id: `uptime_${timestamp.getTime()}`,
        metricName: 'system.uptime',
        value: os.uptime(),
        timestamp,
        tags: { source: 'node', unit: 'seconds' },
        source: 'system'
      });

      metrics.push({
        id: `process_uptime_${timestamp.getTime()}`,
        metricName: 'process.uptime',
        value: process.uptime(),
        timestamp,
        tags: { source: 'node', unit: 'seconds', pid: String(process.pid) },
        source: 'system'
      });

      return metrics;

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to collect system metrics: ${error.message}`,
        'system',
        error
      );
    }
  }

  async getDetailedSystemMetrics(): Promise<SystemMetrics> {
    try {
      const timestamp = new Date();
      const cpuUsage = process.cpuUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      // Get disk usage (Linux/Mac)
      let diskMetrics = { total: 0, used: 0, free: 0 };
      try {
        const { stdout } = await execAsync('df -k / | tail -1');
        const [total, used, _available] = stdout.split(/\s+/).map(Number);
        diskMetrics = {
          total: total * 1024,
          used: used * 1024,
          free: (total - used) * 1024
        };
      } catch {
        // Fallback for Windows or if df command fails
        diskMetrics = { total: 0, used: 0, free: 0 };
      }

      return {
        timestamp,
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000,
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usage: (usedMem / totalMem) * 100
        },
        disk: {
          total: diskMetrics.total,
          used: diskMetrics.used,
          free: diskMetrics.free,
          usage: diskMetrics.total > 0 ? (diskMetrics.used / diskMetrics.total) * 100 : 0
        },
        network: {
          bytesIn: 0, // Would need network interface stats
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0
        },
        uptime: os.uptime()
      };

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to get detailed system metrics: ${error.message}`,
        'system',
        error
      );
    }
  }
}

/**
 * Database Metrics Collector
 * Collects PostgreSQL database performance metrics
 */
export class DatabaseMetricsCollector implements MetricsCollector {
  name = 'database';

  constructor(private connectionPool: any) {}

  isEnabled(): boolean {
    return !!this.connectionPool && process.env.NODE_ENV !== 'test';
  }

  async collect(): Promise<MetricSample[]> {
    try {
      const timestamp = new Date();
      const metrics: MetricSample[] = [];

      if (!this.connectionPool) {
        return metrics;
      }

      // Get pool status
      const poolStatus = this.connectionPool.totalCount ? {
        total: this.connectionPool.totalCount,
        idle: this.connectionPool.idleCount,
        waiting: this.connectionPool.waitingCount
      } : { total: 0, idle: 0, waiting: 0 };

      const active = poolStatus.total - poolStatus.idle;

      metrics.push({
        id: `db_connections_total_${timestamp.getTime()}`,
        metricName: 'database.connections.total',
        value: poolStatus.total,
        timestamp,
        tags: { source: 'postgresql' },
        source: 'database'
      });

      metrics.push({
        id: `db_connections_active_${timestamp.getTime()}`,
        metricName: 'database.connections.active',
        value: active,
        timestamp,
        tags: { source: 'postgresql' },
        source: 'database'
      });

      metrics.push({
        id: `db_connections_idle_${timestamp.getTime()}`,
        metricName: 'database.connections.idle',
        value: poolStatus.idle,
        timestamp,
        tags: { source: 'postgresql' },
        source: 'database'
      });

      metrics.push({
        id: `db_connections_waiting_${timestamp.getTime()}`,
        metricName: 'database.connections.waiting',
        value: poolStatus.waiting,
        timestamp,
        tags: { source: 'postgresql' },
        source: 'database'
      });

      return metrics;

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to collect database metrics: ${error.message}`,
        'database',
        error
      );
    }
  }

  async getDetailedDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const timestamp = new Date();

      if (!this.connectionPool) {
        throw new Error('Database connection pool not available');
      }

      // Get detailed database statistics
      const query = `
        SELECT
          COUNT(*) as total_connections,
          COUNT(*) FILTER (WHERE state = 'active') as active_connections,
          COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      // This would need to be executed with the actual database connection
      // For now, return mock data structure
      return {
        timestamp,
        connections: {
          active: 5,
          idle: 10,
          total: 15,
          max: 100
        },
        queries: {
          selects: 1500,
          inserts: 300,
          updates: 200,
          deletes: 50,
          avgDuration: 45,
          errors: 2
        },
        performance: {
          cacheHitRate: 95.5,
          indexUsage: 88.2,
          slowQueries: 3
        },
        size: {
          database: 1024 * 1024 * 500, // 500MB
          tables: 25,
          indexes: 40
        }
      };

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to get detailed database metrics: ${error.message}`,
        'database',
        error
      );
    }
  }
}

/**
 * Application Metrics Collector
 * Collects application-specific metrics like HTTP requests, errors, etc.
 */
export class ApplicationMetricsCollector implements MetricsCollector {
  name = 'application';

  private metrics = new Map<string, { count: number; sum: number; min: number; max: number }>();

  isEnabled(): boolean {
    return true;
  }

  async collect(): Promise<MetricSample[]> {
    try {
      const timestamp = new Date();
      const metrics: MetricSample[] = [];

      // HTTP Request Metrics
      for (const [metric, data] of this.metrics.entries()) {
        metrics.push({
          id: `${metric}_count_${timestamp.getTime()}`,
          metricName: `${metric}.count`,
          value: data.count,
          timestamp,
          tags: { source: 'application' },
          source: 'application'
        });

        metrics.push({
          id: `${metric}_sum_${timestamp.getTime()}`,
          metricName: `${metric}.sum`,
          value: data.sum,
          timestamp,
          tags: { source: 'application' },
          source: 'application'
        });

        metrics.push({
          id: `${metric}_avg_${timestamp.getTime()}`,
          metricName: `${metric}.avg`,
          value: data.count > 0 ? data.sum / data.count : 0,
          timestamp,
          tags: { source: 'application' },
          source: 'application'
        });

        // Reset counters after collection
        this.metrics.set(metric, { count: 0, sum: 0, min: Infinity, max: -Infinity });
      }

      // Process metrics
      metrics.push({
        id: `process_pid_${timestamp.getTime()}`,
        metricName: 'process.pid',
        value: process.pid,
        timestamp,
        tags: { source: 'application' },
        source: 'application'
      });

      metrics.push({
        id: `process_version_${timestamp.getTime()}`,
        metricName: 'process.version',
        value: process.version,
        timestamp,
        tags: { source: 'application' },
        source: 'application'
      });

      return metrics;

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to collect application metrics: ${error.message}`,
        'application',
        error
      );
    }
  }

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const metricName = `http.request.${method.toLowerCase()}.${route.replace(/\//g, '_')}`;
    this.incrementMetric(metricName, duration);
  }

  recordError(errorType: string, component: string): void {
    const metricName = `error.${component}.${errorType}`;
    this.incrementMetric(metricName, 1);
  }

  recordTenantActivity(tenantId: string, activity: string, value: number = 1): void {
    const metricName = `tenant.${tenantId}.${activity}`;
    this.incrementMetric(metricName, value);
  }

  private incrementMetric(name: string, value: number): void {
    const existing = this.metrics.get(name) || { count: 0, sum: 0, min: Infinity, max: -Infinity };
    this.metrics.set(name, {
      count: existing.count + 1,
      sum: existing.sum + value,
      min: Math.min(existing.min, value),
      max: Math.max(existing.max, value)
    });
  }
}

/**
 * Tenant Metrics Collector
 * Collects tenant-specific metrics
 */
export class TenantMetricsCollector implements MetricsCollector {
  name = 'tenant';

  constructor(private tenantService: any) {}

  isEnabled(): boolean {
    return !!this.tenantService;
  }

  async collect(): Promise<MetricSample[]> {
    try {
      const timestamp = new Date();
      const metrics: MetricSample[] = [];

      if (!this.tenantService) {
        return metrics;
      }

      // This would integrate with the actual tenant service
      // For now, return mock metrics structure
      const activeTenants = 10;
      const totalUsers = 500;
      const activeUsers = 150;

      metrics.push({
        id: `tenants_active_${timestamp.getTime()}`,
        metricName: 'tenants.active',
        value: activeTenants,
        timestamp,
        tags: { source: 'tenant_service' },
        source: 'tenant'
      });

      metrics.push({
        id: `users_total_${timestamp.getTime()}`,
        metricName: 'users.total',
        value: totalUsers,
        timestamp,
        tags: { source: 'tenant_service' },
        source: 'tenant'
      });

      metrics.push({
        id: `users_active_${timestamp.getTime()}`,
        metricName: 'users.active',
        value: activeUsers,
        timestamp,
        tags: { source: 'tenant_service' },
        source: 'tenant'
      });

      return metrics;

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to collect tenant metrics: ${error.message}`,
        'tenant',
        error
      );
    }
  }

  async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
    try {
      const timestamp = new Date();

      // This would integrate with the actual tenant service and database
      // For now, return mock data
      return {
        tenantId,
        timestamp,
        users: {
          total: 50,
          active: 15,
          new: 2
        },
        api: {
          requests: 1500,
          errors: 15,
          avgResponseTime: 120,
          p95ResponseTime: 450,
          p99ResponseTime: 890
        },
        storage: {
          total: 1024 * 1024 * 100, // 100MB
          used: 1024 * 1024 * 25, // 25MB
          files: 500
        },
        database: {
          connections: 5,
          queries: 2000,
          avgResponseTime: 35
        }
      };

    } catch (error) {
      throw new MetricsCollectionError(
        `Failed to get tenant metrics for ${tenantId}: ${error.message}`,
        'tenant',
        error
      );
    }
  }
}

/**
 * Metrics Collector Manager
 * Manages and coordinates all metrics collectors
 */
export class MetricsCollectorManager {
  private collectors: Map<string, MetricsCollector> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(private storageService: any) {}

  registerCollector(collector: MetricsCollector): void {
    this.collectors.set(collector.name, collector);
  }

  unregisterCollector(name: string): void {
    this.collectors.delete(name);
  }

  async collectAllMetrics(): Promise<MetricSample[]> {
    const allMetrics: MetricSample[] = [];
    const errors: Error[] = [];

    for (const collector of this.collectors.values()) {
      if (!collector.isEnabled()) {
        continue;
      }

      try {
        const metrics = await collector.collect();
        allMetrics.push(...metrics);
      } catch (error) {
        errors.push(error);
        console.error(`Failed to collect metrics from ${collector.name}:`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} collectors failed during metrics collection`);
    }

    return allMetrics;
  }

  startCollection(intervalMs: number = 30000): void {
    if (this.intervalId) {
      this.stopCollection();
    }

    this.intervalId = setInterval(async () => {
      try {
        const metrics = await this.collectAllMetrics();
        if (this.storageService && metrics.length > 0) {
          await this.storageService.storeMetrics(metrics);
        }
      } catch (error) {
        console.error('Failed to collect and store metrics:', error);
      }
    }, intervalMs);
  }

  stopCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  isCollecting(): boolean {
    return !!this.intervalId;
  }

  getCollectors(): MetricsCollector[] {
    return Array.from(this.collectors.values());
  }

  getEnabledCollectors(): MetricsCollector[] {
    return this.getCollectors().filter(collector => collector.isEnabled());
  }
}