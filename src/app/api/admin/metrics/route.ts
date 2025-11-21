/**
 * Metrics API Endpoint
 * Provides metrics querying and management functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { MetricsService, MetricsServiceConfig } from '../../../../services/metrics-service';
import { InMemoryMetricsStorage } from '../../../../lib/monitoring/storage';

// Initialize metrics service (in a real app, this would be properly dependency injected)
const storage = new InMemoryMetricsStorage();
const metricsServiceConfig: MetricsServiceConfig = {
  collectionInterval: 30,
  retentionPeriod: 30,
  enabledCollectors: ['system', 'application'],
  storageType: 'memory'
};
const metricsService = new MetricsService(metricsServiceConfig, storage);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const aggregation = searchParams.get('aggregation') || 'avg';
    const interval = searchParams.get('interval');
    const summary = searchParams.get('summary');
    const tenantId = searchParams.get('tenantId');

    // Start metrics collection if not already running
    if (!metricsService.isActive()) {
      await metricsService.startCollection();
    }

    if (summary === 'true') {
      // Get metrics summary for dashboard
      const timeRange = {
        from: from ? new Date(from) : new Date(Date.now() - 60 * 60 * 1000), // Default to 1 hour ago
        to: to ? new Date(to) : new Date()
      };

      const summaryData = await metricsService.getMetricsSummary(timeRange);
      return NextResponse.json({
        success: true,
        data: summaryData
      });
    }

    if (tenantId) {
      // Get tenant-specific metrics
      const tenantMetrics = await metricsService.getTenantMetrics(tenantId);
      return NextResponse.json({
        success: true,
        data: tenantMetrics
      });
    }

    if (metric && from && to) {
      // Query specific metrics
      const queryRequest = {
        metric,
        timeRange: {
          from: new Date(from),
          to: new Date(to)
        },
        aggregation: aggregation as any,
        interval: interval ? parseInt(interval) : undefined
      };

      const result = await metricsService.queryMetrics(queryRequest);
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Get available metrics
    const availableMetrics = await metricsService.getAvailableMetrics();
    return NextResponse.json({
      success: true,
      data: {
        availableMetrics,
        collectorStatus: metricsService.getCollectorStatus(),
        isActive: metricsService.isActive()
      }
    });

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'METRICS_QUERY_ERROR',
          message: error.message || 'Failed to query metrics'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, metric, value, tags, tenantId } = body;

    switch (action) {
      case 'record_metric':
        if (!metric || value === undefined) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_METRIC_DATA',
                message: 'Metric name and value are required'
              }
            },
            { status: 400 }
          );
        }

        metricsService.recordMetric(metric, value, tags || {}, tenantId);
        return NextResponse.json({
          success: true,
          message: 'Metric recorded successfully'
        });

      case 'increment_counter':
        if (!metric) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_METRIC_NAME',
                message: 'Metric name is required'
              }
            },
            { status: 400 }
          );
        }

        metricsService.incrementCounter(metric, value || 1, tags || {}, tenantId);
        return NextResponse.json({
          success: true,
          message: 'Counter incremented successfully'
        });

      case 'record_timing':
        if (!metric || value === undefined) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TIMING_DATA',
                message: 'Metric name and duration are required'
              }
            },
            { status: 400 }
          );
        }

        metricsService.recordTiming(metric, value, tags || {}, tenantId);
        return NextResponse.json({
          success: true,
          message: 'Timing recorded successfully'
        });

      case 'start_collection':
        await metricsService.startCollection();
        return NextResponse.json({
          success: true,
          message: 'Metrics collection started'
        });

      case 'stop_collection':
        metricsService.stopCollection();
        return NextResponse.json({
          success: true,
          message: 'Metrics collection stopped'
        });

      case 'collect_now':
        const metrics = await metricsService.collectMetrics();
        return NextResponse.json({
          success: true,
          data: {
            collectedCount: metrics.length,
            metrics: metrics.slice(0, 10) // Return first 10 for preview
          }
        });

      case 'cleanup_old_metrics':
        const deletedCount = await metricsService.cleanupOldMetrics();
        return NextResponse.json({
          success: true,
          data: {
            deletedCount,
            message: `Cleaned up ${deletedCount} old metrics`
          }
        });

      case 'update_config':
        if (!body.config) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CONFIG',
                message: 'Configuration is required'
              }
            },
            { status: 400 }
          );
        }

        metricsService.updateConfig(body.config);
        return NextResponse.json({
          success: true,
          message: 'Configuration updated successfully',
          data: metricsService.getConfig()
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${action}`
            }
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Metrics management API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'METRICS_MANAGEMENT_ERROR',
          message: error.message || 'Failed to manage metrics'
        }
      },
      { status: 500 }
    );
  }
}