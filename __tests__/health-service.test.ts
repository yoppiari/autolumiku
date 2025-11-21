/**
 * Health Service Tests
 * Unit tests for health monitoring functionality
 */

import { HealthService, HealthServiceConfig } from '../src/services/health-service';
import { MetricsCollectorManager } from '../src/lib/monitoring/collectors';
import { InMemoryMetricsStorage } from '../src/lib/monitoring/storage';

describe('HealthService', () => {
  let healthService: HealthService;
  let metricsManager: MetricsCollectorManager;

  beforeEach(() => {
    const storage = new InMemoryMetricsStorage();
    metricsManager = new MetricsCollectorManager(storage);

    const config: HealthServiceConfig = {
      checkInterval: 1, // 1 second for fast testing
      timeout: 1000,
      retries: 1,
      enabledChecks: ['database', 'redis', 'disk_space', 'memory_usage']
    };

    healthService = new HealthService(config, metricsManager);
  });

  afterEach(() => {
    healthService.stopHealthChecking();
  });

  describe('Health Checks', () => {
    test('should add health check', () => {
      const checkConfig = {
        name: 'test_check',
        timeout: 5000,
        interval: 30,
        retries: 2
      };

      healthService.addHealthCheck(checkConfig);
      const checks = healthService.getHealthChecks();

      expect(checks).toContainEqual(checkConfig);
    });

    test('should remove health check', () => {
      const checkConfig = {
        name: 'test_check',
        timeout: 5000,
        interval: 30,
        retries: 2
      };

      healthService.addHealthCheck(checkConfig);
      healthService.removeHealthCheck('test_check');
      const checks = healthService.getHealthChecks();

      expect(checks).not.toContainEqual(checkConfig);
    });

    test('should run single health check', async () => {
      const result = await healthService.runHealthCheck('database');

      expect(result).toBeDefined();
      expect(result.name).toBe('database');
      expect(['pass', 'warn', 'fail']).toContain(result.status);
      expect(typeof result.duration).toBe('number');
      expect(result.lastChecked).toBeInstanceOf(Date);
    });

    test('should throw error for unknown health check', async () => {
      await expect(healthService.runHealthCheck('unknown_check'))
        .rejects.toThrow('Health check \'unknown_check\' not found');
    });
  });

  describe('Health Status', () => {
    test('should run all health checks', async () => {
      const status = await healthService.runAllHealthChecks();

      expect(status).toBeDefined();
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(status.checks)).toBe(true);
      expect(status.summary).toBeDefined();
      expect(typeof status.summary.total).toBe('number');
      expect(typeof status.summary.score).toBe('number');
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(status.status);
    });

    test('should calculate correct health summary', async () => {
      const status = await healthService.runAllHealthChecks();

      expect(status.summary.total).toBe(status.checks.length);
      expect(status.summary.passing).toBeGreaterThanOrEqual(0);
      expect(status.summary.warning).toBeGreaterThanOrEqual(0);
      expect(status.summary.failing).toBeGreaterThanOrEqual(0);
      expect(status.summary.passing + status.summary.warning + status.summary.failing)
        .toBe(status.summary.total);
    });

    test('should get last health status', async () => {
      await healthService.runAllHealthChecks();
      const lastStatus = healthService.getLastHealthStatus();

      expect(lastStatus).toBeDefined();
      expect(lastStatus?.checks.length).toBeGreaterThan(0);
    });
  });

  describe('Auto Health Checking', () => {
    test('should start health checking', () => {
      expect(healthService.isHealthCheckingActive()).toBe(false);

      healthService.startHealthChecking();

      expect(healthService.isHealthCheckingActive()).toBe(true);
    });

    test('should stop health checking', () => {
      healthService.startHealthChecking();
      expect(healthService.isHealthCheckingActive()).toBe(true);

      healthService.stopHealthChecking();
      expect(healthService.isHealthCheckingActive()).toBe(false);
    });

    test('should handle multiple start/stop cycles', () => {
      for (let i = 0; i < 3; i++) {
        healthService.startHealthChecking();
        expect(healthService.isHealthCheckingActive()).toBe(true);

        healthService.stopHealthChecking();
        expect(healthService.isHealthCheckingActive()).toBe(false);
      }
    });
  });

  describe('Health Score', () => {
    test('should return health score', async () => {
      await healthService.runAllHealthChecks();
      const score = healthService.getHealthScore();

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should return 0 when no health status exists', () => {
      const score = healthService.getHealthScore();
      expect(score).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle health check failures gracefully', async () => {
      // Add a check that will fail
      healthService.addHealthCheck({
        name: 'failing_check',
        timeout: 1, // Very short timeout to cause failure
        interval: 30,
        retries: 1,
        endpoint: 'http://nonexistent-server.test'
      });

      const status = await healthService.runAllHealthChecks();
      const failingCheck = status.checks.find(c => c.name === 'failing_check');

      expect(failingCheck?.status).toBe('fail');
      expect(failingCheck?.message).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('should return enabled health checks', () => {
      const enabledChecks = healthService.getEnabledHealthChecks();
      const configChecks = ['database', 'redis', 'disk_space', 'memory_usage'];

      expect(enabledChecks.length).toBe(configChecks.length);
      enabledChecks.forEach(check => {
        expect(configChecks).toContain(check.name);
      });
    });
  });
});