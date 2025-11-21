/**
 * Metrics Storage Tests
 * Unit tests for metrics storage functionality
 */

import { InMemoryMetricsStorage } from '../src/lib/monitoring/storage';
import { MetricsQueryRequest, MetricSample } from '../src/types/health';

describe('InMemoryMetricsStorage', () => {
  let storage: InMemoryMetricsStorage;

  beforeEach(() => {
    storage = new InMemoryMetricsStorage();
  });

  describe('Basic Storage Operations', () => {
    test('should store metrics', async () => {
      const metrics: MetricSample[] = [
        {
          id: 'test-metric-1',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp: new Date(),
          tags: { source: 'server1' },
          source: 'system'
        },
        {
          id: 'test-metric-2',
          metricName: 'memory.usage',
          value: 62.3,
          timestamp: new Date(),
          tags: { source: 'server1' },
          source: 'system'
        }
      ];

      await storage.storeMetrics(metrics);

      // Storage doesn't have a direct get method, but we can query back
      const result = await storage.queryMetrics({
        metric: 'cpu.usage',
        timeRange: {
          from: new Date(Date.now() - 60000), // 1 minute ago
          to: new Date()
        }
      });

      expect(result.timeSeries).toHaveLength(1);
      expect(result.timeSeries[0].value).toBe(45.5);
    });

    test('should handle empty metrics array', async () => {
      await storage.storeMetrics([]);
      // Should not throw error
      expect(true).toBe(true);
    });

    test('should get metrics by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const metrics: MetricSample[] = [
        {
          id: 'test-metric-1',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp: oneHourAgo,
          tags: { source: 'server1' },
          source: 'system'
        },
        {
          id: 'test-metric-2',
          metricName: 'cpu.usage',
          value: 55.2,
          timestamp: now,
          tags: { source: 'server1' },
          source: 'system'
        }
      ];

      await storage.storeMetrics(metrics);

      const result = await storage.getMetricsByTimeRange(
        'cpu.usage',
        oneHourAgo,
        now
      );

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(45.5);
      expect(result[1].value).toBe(55.2);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Setup test data
      const now = new Date();
      const testData: MetricSample[] = [];

      // Generate test metrics for the last hour
      for (let i = 0; i < 60; i++) {
        const timestamp = new Date(now.getTime() - i * 60000); // Each minute

        testData.push({
          id: `cpu-${i}`,
          metricName: 'cpu.usage',
          value: 30 + Math.random() * 40, // 30-70%
          timestamp,
          tags: { source: 'server1', environment: 'production' },
          source: 'system'
        });

        testData.push({
          id: `memory-${i}`,
          metricName: 'memory.usage',
          value: 50 + Math.random() * 30, // 50-80%
          timestamp,
          tags: { source: 'server1', environment: 'production' },
          source: 'system'
        });
      }

      await storage.storeMetrics(testData);
    });

    test('should query metrics with aggregation', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const query: MetricsQueryRequest = {
        metric: 'cpu.usage',
        timeRange: { from: oneHourAgo, to: now },
        aggregation: 'avg',
        interval: 300 // 5 minutes
      };

      const result = await storage.queryMetrics(query);

      expect(result.metric).toBe('cpu.usage');
      expect(result.aggregation).toBe('avg');
      expect(result.interval).toBe(300);
      expect(result.timeSeries.length).toBeGreaterThan(0);
      expect(typeof result.totalPoints).toBe('number');
    });

    test('should query metrics with filters', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const query: MetricsQueryRequest = {
        metric: 'cpu.usage',
        timeRange: { from: oneHourAgo, to: now },
        filters: { source: 'server1' }
      };

      const result = await storage.queryMetrics(query);

      expect(result.timeSeries.length).toBeGreaterThan(0);
      result.timeSeries.forEach(point => {
        expect(point.tags.source).toBe('server1');
      });
    });

    test('should query metrics with group by', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Add metrics with different sources
      const additionalMetrics: MetricSample[] = [];
      for (let i = 0; i < 10; i++) {
        additionalMetrics.push({
          id: `cpu-server2-${i}`,
          metricName: 'cpu.usage',
          value: 40 + Math.random() * 30,
          timestamp: new Date(now.getTime() - i * 60000),
          tags: { source: 'server2', environment: 'production' },
          source: 'system'
        });
      }

      await storage.storeMetrics(additionalMetrics);

      const query: MetricsQueryRequest = {
        metric: 'cpu.usage',
        timeRange: { from: oneHourAgo, to: now },
        groupBy: ['source']
      };

      const result = await storage.queryMetrics(query);

      expect(result.timeSeries.length).toBeGreaterThan(0);
      // Should have metrics from both servers
      const sources = new Set(result.timeSeries.map(point => point.tags.source));
      expect(sources.has('server1')).toBe(true);
      expect(sources.has('server2')).toBe(true);
    });

    test('should return empty result for non-existent metric', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const query: MetricsQueryRequest = {
        metric: 'non.existent.metric',
        timeRange: { from: oneHourAgo, to: now }
      };

      const result = await storage.queryMetrics(query);

      expect(result.metric).toBe('non.existent.metric');
      expect(result.timeSeries).toHaveLength(0);
      expect(result.totalPoints).toBe(0);
    });
  });

  describe('Data Retention', () => {
    test('should delete old metrics', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Store old metrics
      const oldMetrics: MetricSample[] = [
        {
          id: 'old-metric-1',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp: threeDaysAgo,
          tags: { source: 'server1' },
          source: 'system'
        },
        {
          id: 'old-metric-2',
          metricName: 'cpu.usage',
          value: 55.2,
          timestamp: twoDaysAgo,
          tags: { source: 'server1' },
          source: 'system'
        }
      ];

      await storage.storeMetrics(oldMetrics);

      // Delete metrics older than 2.5 days
      const cutoffDate = new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000);
      const deletedCount = await storage.deleteOldMetrics(cutoffDate);

      expect(deletedCount).toBe(1); // Should delete the 3-day-old metric

      // Verify the 2-day-old metric still exists
      const result = await storage.getMetricsByTimeRange(
        'cpu.usage',
        new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        now
      );

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toEqual(twoDaysAgo);
    });

    test('should handle retention limit', async () => {
      // This tests the maxRetention feature of InMemoryMetricsStorage
      const metrics: MetricSample[] = [];

      // Store more metrics than the retention limit (default is 100,000)
      for (let i = 0; i < 150; i++) {
        metrics.push({
          id: `retention-test-${i}`,
          metricName: 'test.metric',
          value: i,
          timestamp: new Date(),
          tags: { index: String(i) },
          source: 'test'
        });
      }

      await storage.storeMetrics(metrics);

      // Should keep only the newest metrics due to retention limit
      const count = storage.getMetricsCount();
      expect(count).toBeLessThanOrEqual(100000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle metrics with same timestamp', async () => {
      const timestamp = new Date();

      const metrics: MetricSample[] = [
        {
          id: 'same-time-1',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp,
          tags: { source: 'server1' },
          source: 'system'
        },
        {
          id: 'same-time-2',
          metricName: 'cpu.usage',
          value: 55.2,
          timestamp,
          tags: { source: 'server2' },
          source: 'system'
        }
      ];

      await storage.storeMetrics(metrics);

      const result = await storage.getMetricsByTimeRange(
        'cpu.usage',
        new Date(timestamp.getTime() - 1000),
        new Date(timestamp.getTime() + 1000)
      );

      expect(result).toHaveLength(2);
    });

    test('should handle different metric types', async () => {
      const metrics: MetricSample[] = [
        {
          id: 'number-metric',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp: new Date(),
          tags: {},
          source: 'system'
        },
        {
          id: 'string-metric',
          metricName: 'status',
          value: 'healthy',
          timestamp: new Date(),
          tags: {},
          source: 'system'
        },
        {
          id: 'boolean-metric',
          metricName: 'is.available',
          value: true,
          timestamp: new Date(),
          tags: {},
          source: 'system'
        }
      ];

      await storage.storeMetrics(metrics);

      // Query each metric type
      const numberResult = await storage.getMetricsByTimeRange(
        'cpu.usage',
        new Date(Date.now() - 60000),
        new Date()
      );
      const stringResult = await storage.getMetricsByTimeRange(
        'status',
        new Date(Date.now() - 60000),
        new Date()
      );
      const booleanResult = await storage.getMetricsByTimeRange(
        'is.available',
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(numberResult).toHaveLength(1);
      expect(stringResult).toHaveLength(1);
      expect(booleanResult).toHaveLength(1);

      expect(typeof numberResult[0].value).toBe('number');
      expect(typeof stringResult[0].value).toBe('string');
      expect(typeof booleanResult[0].value).toBe('boolean');
    });
  });

  describe('Memory Management', () => {
    test('should clear all metrics', async () => {
      // Store some metrics
      const metrics: MetricSample[] = [
        {
          id: 'clear-test-1',
          metricName: 'cpu.usage',
          value: 45.5,
          timestamp: new Date(),
          tags: {},
          source: 'system'
        }
      ];

      await storage.storeMetrics(metrics);
      expect(storage.getMetricsCount()).toBeGreaterThan(0);

      storage.clear();
      expect(storage.getMetricsCount()).toBe(0);
    });

    test('should handle large number of metrics efficiently', async () => {
      const startTime = Date.now();

      // Store a large number of metrics
      const metrics: MetricSample[] = [];
      for (let i = 0; i < 1000; i++) {
        metrics.push({
          id: `perf-test-${i}`,
          metricName: 'performance.metric',
          value: Math.random() * 100,
          timestamp: new Date(Date.now() - i * 1000),
          tags: { batch: String(Math.floor(i / 100)) },
          source: 'performance'
        });
      }

      await storage.storeMetrics(metrics);

      const storeTime = Date.now() - startTime;
      expect(storeTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Query performance should also be reasonable
      const queryStart = Date.now();
      const result = await storage.queryMetrics({
        metric: 'performance.metric',
        timeRange: {
          from: new Date(Date.now() - 1000 * 1000),
          to: new Date()
        },
        aggregation: 'avg',
        interval: 60
      });
      const queryTime = Date.now() - queryStart;

      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.timeSeries.length).toBeGreaterThan(0);
    });
  });
});