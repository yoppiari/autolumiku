/**
 * Health Service
 * Main service for platform health monitoring and status checks
 */

import {
  HealthStatus,
  HealthCheck,
  HealthSummary,
  HealthCheckConfig,
  HealthMonitoringError
} from '../../types/health';
import { SystemMetricsCollector, ApplicationMetricsCollector } from '../../lib/monitoring/collectors';
import { MetricsCollectorManager } from '../../lib/monitoring/collectors';

export interface HealthServiceConfig {
  checkInterval: number; // seconds
  timeout: number; // milliseconds
  retries: number;
  enabledChecks: string[];
}

export class HealthService {
  private healthChecks: Map<string, HealthCheckConfig> = new Map();
  private checkResults: Map<string, HealthCheck> = new Map();
  private lastHealthStatus?: HealthStatus;
  private checkIntervalId?: NodeJS.Timeout;

  constructor(
    private config: HealthServiceConfig,
    private metricsManager: MetricsCollectorManager
  ) {
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultChecks(): void {
    // Database Health Check
    this.addHealthCheck({
      name: 'database',
      timeout: 5000,
      interval: 30,
      retries: 3,
      expectedStatus: 200,
      method: 'GET'
    });

    // Redis Health Check
    this.addHealthCheck({
      name: 'redis',
      timeout: 3000,
      interval: 30,
      retries: 2,
      expectedStatus: 200,
      method: 'GET'
    });

    // External API Health Checks
    this.addHealthCheck({
      name: 'external_apis',
      timeout: 10000,
      interval: 60,
      retries: 2,
      expectedStatus: 200,
      method: 'GET'
    });

    // Disk Space Health Check
    this.addHealthCheck({
      name: 'disk_space',
      timeout: 2000,
      interval: 60,
      retries: 1
    });

    // Memory Usage Health Check
    this.addHealthCheck({
      name: 'memory_usage',
      timeout: 1000,
      interval: 30,
      retries: 1
    });
  }

  /**
   * Add a new health check
   */
  addHealthCheck(config: HealthCheckConfig): void {
    this.healthChecks.set(config.name, config);
  }

  /**
   * Remove a health check
   */
  removeHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.checkResults.delete(name);
  }

  /**
   * Get all configured health checks
   */
  getHealthChecks(): HealthCheckConfig[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get enabled health checks
   */
  getEnabledHealthChecks(): HealthCheckConfig[] {
    return this.getHealthChecks().filter(check =>
      this.config.enabledChecks.includes(check.name)
    );
  }

  /**
   * Run a single health check
   */
  async runHealthCheck(name: string): Promise<HealthCheck> {
    const config = this.healthChecks.get(name);
    if (!config) {
      throw new HealthMonitoringError(
        `Health check '${name}' not found`,
        'HEALTH_CHECK_NOT_FOUND'
      );
    }

    const startTime = Date.now();
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message: string | undefined;
    let details: Record<string, any> | undefined;

    try {
      switch (name) {
        case 'database':
          await this.checkDatabaseHealth();
          break;
        case 'redis':
          await this.checkRedisHealth();
          break;
        case 'external_apis':
          await this.checkExternalAPIsHealth();
          break;
        case 'disk_space':
          await this.checkDiskSpaceHealth();
          break;
        case 'memory_usage':
          await this.checkMemoryUsageHealth();
          break;
        default:
          if (config.endpoint) {
            await this.checkHTTPHealth(config);
          } else {
            throw new HealthMonitoringError(
              `No health check implementation for '${name}'`,
              'HEALTH_CHECK_NOT_IMPLEMENTED'
            );
          }
      }

    } catch (error) {
      status = 'fail';
      message = error.message;
      details = {
        error: error.message,
        stack: error.stack,
        code: error.code || 'UNKNOWN_ERROR'
      };
    }

    const duration = Date.now() - startTime;
    const healthCheck: HealthCheck = {
      name,
      status,
      duration,
      message,
      details,
      lastChecked: new Date()
    };

    this.checkResults.set(name, healthCheck);
    return healthCheck;
  }

  /**
   * Run all enabled health checks
   */
  async runAllHealthChecks(): Promise<HealthStatus> {
    const enabledChecks = this.getEnabledHealthChecks();
    const checks: HealthCheck[] = [];

    for (const config of enabledChecks) {
      try {
        const check = await this.runHealthCheck(config.name);
        checks.push(check);
      } catch (error) {
        // Create a failed check for any errors
        checks.push({
          name: config.name,
          status: 'fail',
          duration: 0,
          message: error.message,
          details: { error: error.message },
          lastChecked: new Date()
        });
      }
    }

    const summary = this.calculateHealthSummary(checks);
    const overallStatus = this.determineOverallStatus(summary);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      summary
    };

    this.lastHealthStatus = healthStatus;
    return healthStatus;
  }

  /**
   * Get the most recent health status
   */
  getLastHealthStatus(): HealthStatus | undefined {
    return this.lastHealthStatus;
  }

  /**
   * Get individual health check result
   */
  getHealthCheckResult(name: string): HealthCheck | undefined {
    return this.checkResults.get(name);
  }

  /**
   * Start automatic health checking
   */
  startHealthChecking(): void {
    if (this.checkIntervalId) {
      this.stopHealthChecking();
    }

    this.checkIntervalId = setInterval(async () => {
      try {
        await this.runAllHealthChecks();
      } catch (error) {
        console.error('Failed to run health checks:', error);
      }
    }, this.config.checkInterval * 1000);
  }

  /**
   * Stop automatic health checking
   */
  stopHealthChecking(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
    }
  }

  /**
   * Check if automatic health checking is running
   */
  isHealthCheckingActive(): boolean {
    return !!this.checkIntervalId;
  }

  /**
   * Get platform health score (0-100)
   */
  getHealthScore(): number {
    if (!this.lastHealthStatus) {
      return 0;
    }
    return this.lastHealthStatus.summary.score;
  }

  /**
   * Calculate health summary from checks
   */
  private calculateHealthSummary(checks: HealthCheck[]): HealthSummary {
    const total = checks.length;
    const passing = checks.filter(c => c.status === 'pass').length;
    const warning = checks.filter(c => c.status === 'warn').length;
    const failing = checks.filter(c => c.status === 'fail').length;

    // Calculate score: pass = 100%, warn = 50%, fail = 0%
    const score = total > 0 ? Math.round(
      ((passing * 100) + (warning * 50)) / total
    ) : 0;

    return {
      total,
      passing,
      warning,
      failing,
      score
    };
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(summary: HealthSummary): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (summary.total === 0) {
      return 'unknown';
    }

    if (summary.failing > 0) {
      // If more than half of checks are failing, it's critical
      return summary.failing > summary.total / 2 ? 'critical' : 'warning';
    }

    if (summary.warning > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Database health check implementation
   */
  private async checkDatabaseHealth(): Promise<void> {
    // This would connect to the actual database and run a simple query
    // For now, we'll simulate the check
    const appCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'application') as ApplicationMetricsCollector;

    if (!appCollector) {
      throw new HealthMonitoringError(
        'Application metrics collector not available',
        'DATABASE_HEALTH_CHECK_FAILED'
      );
    }

    // Simulate database connection test
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Redis health check implementation
   */
  private async checkRedisHealth(): Promise<void> {
    // This would connect to Redis and run a PING command
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  /**
   * External APIs health check implementation
   */
  private async checkExternalAPIsHealth(): Promise<void> {
    // This would check critical external services
    const services = ['ai-service', 'notification-service', 'storage-service'];

    for (const service of services) {
      // Simulate checking each service
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Disk space health check implementation
   */
  private async checkDiskSpaceHealth(): Promise<void> {
    const systemCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'system') as SystemMetricsCollector;

    if (!systemCollector) {
      throw new HealthMonitoringError(
        'System metrics collector not available',
        'DISK_HEALTH_CHECK_FAILED'
      );
    }

    const systemMetrics = await systemCollector.getDetailedSystemMetrics();
    const diskUsage = systemMetrics.disk.usage;

    // Alert if disk usage is above 85%
    if (diskUsage > 85) {
      throw new HealthMonitoringError(
        `Disk usage is critical: ${diskUsage.toFixed(1)}%`,
        'DISK_USAGE_HIGH',
        { usage: diskUsage }
      );
    }

    // Warning if disk usage is above 70%
    if (diskUsage > 70) {
      throw new HealthMonitoringError(
        `Disk usage is high: ${diskUsage.toFixed(1)}%`,
        'DISK_USAGE_WARNING',
        { usage: diskUsage }
      );
    }
  }

  /**
   * Memory usage health check implementation
   */
  private async checkMemoryUsageHealth(): Promise<void> {
    const systemCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'system') as SystemMetricsCollector;

    if (!systemCollector) {
      throw new HealthMonitoringError(
        'System metrics collector not available',
        'MEMORY_HEALTH_CHECK_FAILED'
      );
    }

    const systemMetrics = await systemCollector.getDetailedSystemMetrics();
    const memoryUsage = systemMetrics.memory.usage;

    // Alert if memory usage is above 90%
    if (memoryUsage > 90) {
      throw new HealthMonitoringError(
        `Memory usage is critical: ${memoryUsage.toFixed(1)}%`,
        'MEMORY_USAGE_HIGH',
        { usage: memoryUsage }
      );
    }

    // Warning if memory usage is above 80%
    if (memoryUsage > 80) {
      throw new HealthMonitoringError(
        `Memory usage is high: ${memoryUsage.toFixed(1)}%`,
        'MEMORY_USAGE_WARNING',
        { usage: memoryUsage }
      );
    }
  }

  /**
   * HTTP health check implementation
   */
  private async checkHTTPHealth(config: HealthCheckConfig): Promise<void> {
    if (!config.endpoint) {
      throw new HealthMonitoringError(
        'HTTP endpoint not configured',
        'HTTP_HEALTH_CHECK_FAILED'
      );
    }

    // This would make an actual HTTP request
    // For now, simulate the request
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate response status check
    if (config.expectedStatus && config.expectedStatus !== 200) {
      throw new HealthMonitoringError(
        `Unexpected status code`,
        'HTTP_HEALTH_CHECK_UNEXPECTED_STATUS',
        { expected: config.expectedStatus, actual: 200 }
      );
    }
  }

  /**
   * Get detailed health metrics
   */
  async getDetailedHealthMetrics(): Promise<{
    system: any;
    database: any;
    application: any;
    checks: HealthCheck[];
  }> {
    const systemCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'system') as SystemMetricsCollector;

    const dbCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'database');

    const appCollector = this.metricsManager.getCollectors()
      .find(c => c.name === 'application') as ApplicationMetricsCollector;

    const [systemMetrics, databaseMetrics] = await Promise.all([
      systemCollector?.getDetailedSystemMetrics(),
      dbCollector ? (dbCollector as any).getDetailedDatabaseMetrics() : null
    ]);

    return {
      system: systemMetrics,
      database: databaseMetrics,
      application: {
        uptime: process.uptime(),
        version: process.version,
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      checks: Array.from(this.checkResults.values())
    };
  }
}