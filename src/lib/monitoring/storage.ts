/**
 * Metrics Storage
 * Handles storage and retrieval of time-series metrics data
 */

import { MetricSample, MetricsQueryRequest, MetricsQueryResponse, TimeSeriesData } from '../../types/health';

export interface MetricsStorage {
  storeMetrics(metrics: MetricSample[]): Promise<void>;
  queryMetrics(request: MetricsQueryRequest): Promise<MetricsQueryResponse>;
  deleteOldMetrics(beforeDate: Date): Promise<number>;
  getMetricsByTimeRange(
    metricName: string,
    from: Date,
    to: Date,
    filters?: Record<string, string>
  ): Promise<MetricSample[]>;
}

/**
 * In-Memory Metrics Storage
 * For development and testing environments
 */
export class InMemoryMetricsStorage implements MetricsStorage {
  private metrics: MetricSample[] = [];
  private maxRetention = 100000; // Maximum number of metrics to keep in memory

  async storeMetrics(metrics: MetricSample[]): Promise<void> {
    // Add new metrics
    this.metrics.push(...metrics);

    // Remove old metrics if we exceed the retention limit
    if (this.metrics.length > this.maxRetention) {
      // Sort by timestamp and keep only the newest metrics
      this.metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      this.metrics = this.metrics.slice(0, this.maxRetention);
    }
  }

  async queryMetrics(request: MetricsQueryRequest): Promise<MetricsQueryResponse> {
    const { metric, timeRange, aggregation, interval, filters, groupBy } = request;

    // Filter metrics by name and time range
    let filteredMetrics = this.metrics.filter(m =>
      m.metricName === metric &&
      m.timestamp >= timeRange.from &&
      m.timestamp <= timeRange.to
    );

    // Apply additional filters
    if (filters) {
      filteredMetrics = filteredMetrics.filter(m => {
        return Object.entries(filters).every(([key, value]) =>
          m.tags[key] === value
        );
      });
    }

    // Sort by timestamp
    filteredMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Group by tags if specified
    if (groupBy && groupBy.length > 0) {
      const grouped = new Map<string, MetricSample[]>();

      filteredMetrics.forEach(metric => {
        const key = groupBy.map(tag => metric.tags[tag] || '').join('|');
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(metric);
      });

      // Convert grouped data to time series
      const timeSeries: TimeSeriesData[] = [];
      const timestamps = new Set<number>();

      // Collect all unique timestamps
      grouped.forEach(metrics => {
        metrics.forEach(m => timestamps.add(m.timestamp.getTime()));
      });

      const sortedTimestamps = Array.from(timestamps).sort();

      // Create time series data points
      sortedTimestamps.forEach(timestamp => {
        const point: TimeSeriesData = {
          timestamp: new Date(timestamp),
          value: 0,
          tags: {}
        };

        // Aggregate values from all groups at this timestamp
        let totalValue = 0;
        let count = 0;

        grouped.forEach((groupMetrics, groupKey) => {
          const metric = groupMetrics.find(m => m.timestamp.getTime() === timestamp);
          if (metric) {
            const value = typeof metric.value === 'number' ? metric.value : 0;
            totalValue += value;
            count++;

            // Add group tags
            groupKey.split('|').forEach((tagValue, index) => {
              if (tagValue) {
                point.tags[groupBy[index]] = tagValue;
              }
            });
          }
        });

        point.value = this.aggregateValues([totalValue], aggregation || 'avg', count);
        timeSeries.push(point);
      });

      return {
        metric,
        timeSeries,
        aggregation,
        interval,
        totalPoints: timeSeries.length
      };
    }

    // Create time series from filtered metrics
    let timeSeries: TimeSeriesData[];

    if (interval) {
      // Aggregate metrics by interval
      const intervalMs = interval * 1000;
      const aggregated = new Map<number, number[]>();

      filteredMetrics.forEach(metric => {
        const timestamp = metric.timestamp.getTime();
        const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;

        if (!aggregated.has(intervalStart)) {
          aggregated.set(intervalStart, []);
        }

        const value = typeof metric.value === 'number' ? metric.value : 0;
        aggregated.get(intervalStart)!.push(value);
      });

      timeSeries = Array.from(aggregated.entries())
        .map(([timestamp, values]) => ({
          timestamp: new Date(timestamp),
          value: this.aggregateValues(values, aggregation || 'avg'),
          tags: filteredMetrics.find(m => m.timestamp.getTime() === timestamp)?.tags || {}
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    } else {
      // No interval aggregation
      timeSeries = filteredMetrics.map(metric => ({
        timestamp: metric.timestamp,
        value: typeof metric.value === 'number' ? metric.value : 0,
        tags: metric.tags
      }));
    }

    return {
      metric,
      timeSeries,
      aggregation,
      interval,
      totalPoints: timeSeries.length
    };
  }

  async deleteOldMetrics(beforeDate: Date): Promise<number> {
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= beforeDate);
    return initialCount - this.metrics.length;
  }

  async getMetricsByTimeRange(
    metricName: string,
    from: Date,
    to: Date,
    filters?: Record<string, string>
  ): Promise<MetricSample[]> {
    return this.queryMetrics({
      metric: metricName,
      timeRange: { from, to },
      filters
    }).then(result =>
      result.timeSeries.map(ts => ({
        id: `${metricName}_${ts.timestamp.getTime()}`,
        metricName,
        value: ts.value,
        timestamp: ts.timestamp,
        tags: ts.tags,
        source: 'query'
      }))
    );
  }

  private aggregateValues(values: number[], aggregation: string, count?: number): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'count':
        return count || values.length;
      default:
        return values[values.length - 1]; // Last value
    }
  }

  // For testing purposes
  getMetricsCount(): number {
    return this.metrics.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

/**
 * PostgreSQL Metrics Storage
 * Production-ready metrics storage using PostgreSQL
 */
export class PostgreSQLMetricsStorage implements MetricsStorage {
  constructor(private pool: any) {}

  async storeMetrics(metrics: MetricSample[]): Promise<void> {
    if (!metrics.length) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Prepare insert statement
      const insertQuery = `
        INSERT INTO metrics_samples (
          id, metric_name, value, timestamp, tags, tenant_id, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `;

      for (const metric of metrics) {
        await client.query(insertQuery, [
          metric.id,
          metric.metricName,
          metric.value,
          metric.timestamp,
          JSON.stringify(metric.tags),
          metric.tenantId || null,
          metric.source
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async queryMetrics(request: MetricsQueryRequest): Promise<MetricsQueryResponse> {
    const { metric, timeRange, aggregation, interval, filters, groupBy } = request;
    const client = await this.pool.connect();

    try {
      let query = `
        SELECT
          timestamp,
          value,
          tags,
          tenant_id
        FROM metrics_samples
        WHERE metric_name = $1
          AND timestamp >= $2
          AND timestamp <= $3
      `;

      const params: any[] = [metric, timeRange.from, timeRange.to];
      let paramIndex = 4;

      // Add filters
      if (filters && Object.keys(filters).length > 0) {
        const filterConditions: string[] = [];
        Object.entries(filters).forEach(([key, value]) => {
          filterConditions.push(`tags->>'${key}' = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        });
        query += ` AND ${filterConditions.join(' AND ')}`;
      }

      query += ` ORDER BY timestamp ASC`;

      const result = await client.query(query, params);
      const metrics: MetricSample[] = result.rows.map(row => ({
        id: `${metric}_${row.timestamp.getTime()}`,
        metricName: metric,
        value: row.value,
        timestamp: row.timestamp,
        tags: row.tags,
        tenantId: row.tenant_id,
        source: 'database'
      }));

      // Convert to time series format
      let timeSeries: TimeSeriesData[];

      if (interval) {
        // Aggregate by interval using SQL
        const intervalMs = interval * 1000;
        const aggregationSQL = this.getAggregationSQL(aggregation || 'avg');

        const aggregatedQuery = `
          SELECT
            floor(extract(epoch from timestamp) / ${interval}) * ${interval} as interval_time,
            ${aggregationSQL} as aggregated_value,
            json_build_object(
              'tenant_id', tenant_id
            ) as aggregated_tags
          FROM metrics_samples
          WHERE metric_name = $1
            AND timestamp >= $2
            AND timestamp <= $3
          GROUP BY interval_time, tenant_id
          ORDER BY interval_time ASC
        `;

        const aggregatedResult = await client.query(aggregatedQuery, params);

        timeSeries = aggregatedResult.rows.map(row => ({
          timestamp: new Date(row.interval_time * 1000),
          value: Number(row.aggregated_value),
          tags: row.aggregated_tags
        }));
      } else {
        // No interval aggregation
        timeSeries = metrics.map(m => ({
          timestamp: m.timestamp,
          value: typeof m.value === 'number' ? m.value : 0,
          tags: m.tags
        }));
      }

      return {
        metric,
        timeSeries,
        aggregation,
        interval,
        totalPoints: timeSeries.length
      };

    } finally {
      client.release();
    }
  }

  async deleteOldMetrics(beforeDate: Date): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM metrics_samples WHERE timestamp < $1',
        [beforeDate]
      );
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  async getMetricsByTimeRange(
    metricName: string,
    from: Date,
    to: Date,
    filters?: Record<string, string>
  ): Promise<MetricSample[]> {
    const result = await this.queryMetrics({
      metric: metricName,
      timeRange: { from, to },
      filters
    });

    return result.timeSeries.map(ts => ({
      id: `${metricName}_${ts.timestamp.getTime()}`,
      metricName,
      value: ts.value,
      timestamp: ts.timestamp,
      tags: ts.tags,
      source: 'database'
    }));
  }

  async initializeMetricsTable(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS metrics_samples (
          id VARCHAR(255) PRIMARY KEY,
          metric_name VARCHAR(255) NOT NULL,
          value DOUBLE PRECISION NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          tags JSONB,
          tenant_id UUID,
          source VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes for better query performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp
        ON metrics_samples (metric_name, timestamp DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_tenant_timestamp
        ON metrics_samples (tenant_id, timestamp DESC)
        WHERE tenant_id IS NOT NULL
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_created_at
        ON metrics_samples (created_at DESC)
      `);

    } finally {
      client.release();
    }
  }

  private getAggregationSQL(aggregation: string): string {
    switch (aggregation) {
      case 'avg':
        return 'AVG(value)';
      case 'min':
        return 'MIN(value)';
      case 'max':
        return 'MAX(value)';
      case 'sum':
        return 'SUM(value)';
      case 'count':
        return 'COUNT(value)';
      default:
        return 'AVG(value)';
    }
  }
}

/**
 * Redis Metrics Storage
 * Fast in-memory metrics storage with persistence
 */
export class RedisMetricsStorage implements MetricsStorage {
  constructor(private redis: any) {}

  async storeMetrics(metrics: MetricSample[]): Promise<void> {
    if (!metrics.length) return;

    const pipeline = this.redis.pipeline();

    for (const metric of metrics) {
      const key = `metrics:${metric.metricName}`;
      const score = metric.timestamp.getTime();
      const member = JSON.stringify({
        id: metric.id,
        value: metric.value,
        tags: metric.tags,
        tenantId: metric.tenantId,
        source: metric.source
      });

      pipeline.zadd(key, score, member);

      // Set expiration for the key (e.g., 30 days)
      pipeline.expire(key, 30 * 24 * 60 * 60);
    }

    await pipeline.exec();
  }

  async queryMetrics(request: MetricsQueryRequest): Promise<MetricsQueryResponse> {
    const { metric, timeRange, aggregation, interval, filters } = request;
    const key = `metrics:${metric}`;

    // Get metrics in the time range
    const minScore = timeRange.from.getTime();
    const maxScore = timeRange.to.getTime();

    const results = await this.redis.zrangebyscore(
      key,
      minScore,
      maxScore,
      'WITHSCORES'
    );

    const timeSeries: TimeSeriesData[] = [];

    for (let i = 0; i < results.length; i += 2) {
      const member = JSON.parse(results[i]);
      const timestamp = new Date(Number(results[i + 1]));

      // Apply filters
      if (filters) {
        const matches = Object.entries(filters).every(([key, value]) =>
          member.tags && member.tags[key] === value
        );
        if (!matches) continue;
      }

      timeSeries.push({
        timestamp,
        value: typeof member.value === 'number' ? member.value : 0,
        tags: member.tags || {}
      });
    }

    // Sort by timestamp
    timeSeries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply interval aggregation if needed
    if (interval && timeSeries.length > 0) {
      const intervalMs = interval * 1000;
      const aggregated = new Map<number, number[]>();

      timeSeries.forEach(point => {
        const intervalStart = Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs;

        if (!aggregated.has(intervalStart)) {
          aggregated.set(intervalStart, []);
        }
        aggregated.get(intervalStart)!.push(point.value);
      });

      const aggregatedTimeSeries = Array.from(aggregated.entries())
        .map(([timestamp, values]) => ({
          timestamp: new Date(timestamp),
          value: this.aggregateValues(values, aggregation || 'avg'),
          tags: {}
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        metric,
        timeSeries: aggregatedTimeSeries,
        aggregation,
        interval,
        totalPoints: aggregatedTimeSeries.length
      };
    }

    return {
      metric,
      timeSeries,
      aggregation,
      interval,
      totalPoints: timeSeries.length
    };
  }

  async deleteOldMetrics(beforeDate: Date): Promise<number> {
    // Get all metric keys
    const keys = await this.redis.keys('metrics:*');
    let totalDeleted = 0;

    for (const key of keys) {
      const beforeScore = beforeDate.getTime();
      const removed = await this.redis.zremrangebyscore(key, '-inf', beforeScore);
      totalDeleted += removed;
    }

    return totalDeleted;
  }

  async getMetricsByTimeRange(
    metricName: string,
    from: Date,
    to: Date,
    filters?: Record<string, string>
  ): Promise<MetricSample[]> {
    const result = await this.queryMetrics({
      metric: metricName,
      timeRange: { from, to },
      filters
    });

    return result.timeSeries.map(ts => ({
      id: `${metricName}_${ts.timestamp.getTime()}`,
      metricName,
      value: ts.value,
      timestamp: ts.timestamp,
      tags: ts.tags,
      source: 'redis'
    }));
  }

  private aggregateValues(values: number[], aggregation: string): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'count':
        return values.length;
      default:
        return values[values.length - 1];
    }
  }
}