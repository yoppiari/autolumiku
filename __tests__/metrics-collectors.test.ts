/**
 * Metrics Collectors Tests
 * Unit tests for metrics collection functionality
 */

import { SystemMetricsCollector, ApplicationMetricsCollector } from '../src/lib/monitoring/collectors';
import { MetricSample, MetricsCollectionError } from '../src/types/health';

describe('SystemMetricsCollector', () => {
  let collector: SystemMetricsCollector;

  beforeEach(() => {
    collector = new SystemMetricsCollector();
  });

  describe('Basic Functionality', () => {
    test('should have correct name', () => {
      expect(collector.name).toBe('system');
    });

    test('should be enabled by default', () => {
      expect(collector.isEnabled()).toBe(true);
    });

    test('should collect system metrics', async () => {
      const metrics = await collector.collect();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('metricName');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('tags');
        expect(metric).toHaveProperty('source');
        expect(metric.source).toBe('system');
      });
    });

    test('should collect CPU metrics', async () => {
      const metrics = await collector.collect();
      const cpuMetrics = metrics.filter(m => m.metricName.startsWith('system.cpu'));

      expect(cpuMetrics.length).toBeGreaterThan(0);

      const cpuUsageMetric = cpuMetrics.find(m => m.metricName === 'system.cpu.usage');
      expect(cpuUsageMetric).toBeDefined();
      expect(typeof cpuUsageMetric!.value).toBe('number');
    });

    test('should collect memory metrics', async () => {
      const metrics = await collector.collect();
      const memoryMetrics = metrics.filter(m => m.metricName.startsWith('system.memory'));

      expect(memoryMetrics.length).toBeGreaterThan(0);

      const memoryUsageMetric = memoryMetrics.find(m => m.metricName === 'system.memory.usage');
      expect(memoryUsageMetric).toBeDefined();
      expect(typeof memoryUsageMetric!.value).toBe('number');
      expect(memoryUsageMetric!.value).toBeGreaterThanOrEqual(0);
      expect(memoryUsageMetric!.value).toBeLessThanOrEqual(100);
    });
  });

  describe('Detailed Metrics', () => {
    test('should get detailed system metrics', async () => {
      const detailedMetrics = await collector.getDetailedSystemMetrics();

      expect(detailedMetrics).toBeDefined();
      expect(detailedMetrics.timestamp).toBeInstanceOf(Date);

      expect(detailedMetrics.cpu).toBeDefined();
      expect(detailedMetrics.memory).toBeDefined();
      expect(detailedMetrics.disk).toBeDefined();
      expect(detailedMetrics.uptime).toBeDefined();

      expect(typeof detailedMetrics.cpu.usage).toBe('number');
      expect(typeof detailedMetrics.cpu.cores).toBe('number');
      expect(Array.isArray(detailedMetrics.cpu.loadAverage)).toBe(true);
      expect(detailedMetrics.cpu.loadAverage).toHaveLength(3);

      expect(typeof detailedMetrics.memory.total).toBe('number');
      expect(typeof detailedMetrics.memory.used).toBe('number');
      expect(typeof detailedMetrics.memory.free).toBe('number');
      expect(typeof detailedMetrics.memory.usage).toBe('number');

      expect(typeof detailedMetrics.uptime).toBe('number');
      expect(detailedMetrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle collection errors gracefully', async () => {
      // Mock process.cpuUsage to throw an error
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn().mockImplementation(() => {
        throw new Error('Simulated error');
      });

      await expect(collector.collect()).rejects.toThrow(MetricsCollectionError);

      // Restore original function
      process.cpuUsage = originalCpuUsage;
    });
  });
});

describe('ApplicationMetricsCollector', () => {
  let collector: ApplicationMetricsCollector;

  beforeEach(() => {
    collector = new ApplicationMetricsCollector();
  });

  describe('Basic Functionality', () => {
    test('should have correct name', () => {
      expect(collector.name).toBe('application');
    });

    test('should be enabled by default', () => {
      expect(collector.isEnabled()).toBe(true);
    });

    test('should collect application metrics', async () => {
      const metrics = await collector.collect();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      metrics.forEach(metric => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('metricName');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('tags');
        expect(metric).toHaveProperty('source');
        expect(metric.source).toBe('application');
      });
    });

    test('should collect process metrics', async () => {
      const metrics = await collector.collect();
      const processMetrics = metrics.filter(m => m.metricName.startsWith('process'));

      expect(processMetrics.length).toBeGreaterThan(0);

      const pidMetric = processMetrics.find(m => m.metricName === 'process.pid');
      expect(pidMetric).toBeDefined();
      expect(pidMetric!.value).toBe(process.pid);

      const uptimeMetric = processMetrics.find(m => m.metricName === 'process.uptime');
      expect(uptimeMetric).toBeDefined();
      expect(typeof uptimeMetric!.value).toBe('number');
      expect(uptimeMetric!.value).toBeGreaterThan(0);
    });
  });

  describe('Metric Recording', () => {
    test('should record HTTP request metrics', () => {
      collector.recordHttpRequest('GET', '/api/test', 200, 150);
      collector.recordHttpRequest('POST', '/api/users', 201, 250);

      // Collect metrics to verify recording
      const metrics = collector.collect();
      const getMetrics = metrics.filter(m => m.metricName.includes('http.request.get'));
      const postMetrics = metrics.filter(m => m.metricName.includes('http.request.post'));

      expect(getMetrics.length).toBeGreaterThan(0);
      expect(postMetrics.length).toBeGreaterThan(0);
    });

    test('should record error metrics', () => {
      collector.recordError('ValidationError', 'api');
      collector.recordError('DatabaseError', 'database');

      // Collect metrics to verify recording
      const metrics = collector.collect();
      const errorMetrics = metrics.filter(m => m.metricName.startsWith('error'));

      expect(errorMetrics.length).toBeGreaterThan(0);
    });

    test('should record tenant activity metrics', () => {
      collector.recordTenantActivity('tenant-123', 'login', 1);
      collector.recordTenantActivity('tenant-456', 'api_requests', 5);

      // Collect metrics to verify recording
      const metrics = collector.collect();
      const tenantMetrics = metrics.filter(m => m.metricName.startsWith('tenant'));

      expect(tenantMetrics.length).toBeGreaterThan(0);
    });

    test('should increment counter metrics', () => {
      collector.incrementCounter('user_registrations', 1);
      collector.incrementCounter('user_registrations', 2);
      collector.incrementCounter('page_views', 5);

      // Collect metrics to verify increment
      const metrics = collector.collect();
      const regMetrics = metrics.filter(m => m.metricName === 'user_registrations.count');
      const viewMetrics = metrics.filter(m => m.metricName === 'page_views.count');

      expect(regMetrics.length).toBe(1);
      expect(viewMetrics.length).toBe(1);
    });

    test('should record timing metrics', () => {
      collector.recordTiming('api_response_time', 150);
      collector.recordTiming('database_query_time', 45);

      // Collect metrics to verify timing
      const metrics = collector.collect();
      const timingMetrics = metrics.filter(m => m.metricName.includes('.duration'));

      expect(timingMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Aggregation', () => {
    test('should aggregate multiple values for the same metric', async () => {
      // Record multiple values for the same metric
      collector.recordTiming('api_response_time', 100);
      collector.recordTiming('api_response_time', 200);
      collector.recordTiming('api_response_time', 150);

      const metrics = await collector.collect();
      const avgMetric = metrics.find(m => m.metricName === 'api_response_time.avg');
      const sumMetric = metrics.find(m => m.metricName === 'api_response_time.sum');
      const countMetric = metrics.find(m => m.metricName === 'api_response_time.count');

      expect(avgMetric).toBeDefined();
      expect(sumMetric).toBeDefined();
      expect(countMetric).toBeDefined();

      expect(avgMetric!.value).toBe(150); // (100 + 200 + 150) / 3
      expect(sumMetric!.value).toBe(450); // 100 + 200 + 150
      expect(countMetric!.value).toBe(3); // 3 values
    });
  });

  describe('Tags and Metadata', () => {
    test('should include tags in recorded metrics', () => {
      collector.recordHttpRequest('GET', '/api/test', 200, 150);

      const metrics = collector.collect();
      const httpMetrics = metrics.filter(m => m.metricName.includes('http.request'));

      httpMetrics.forEach(metric => {
        expect(metric.tags).toBeDefined();
        expect(metric.tags.source).toBe('node');
      });
    });

    test('should handle custom tags', () => {
      collector.recordMetric('custom.metric', 100, {
        component: 'auth',
        version: '1.0.0'
      });

      const metrics = collector.collect();
      const customMetric = metrics.find(m => m.metricName === 'custom.metric');

      expect(customMetric).toBeDefined();
      expect(customMetric!.tags.component).toBe('auth');
      expect(customMetric!.tags.version).toBe('1.0.0');
    });
  });
});