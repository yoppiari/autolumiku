/**
 * Health Status API Endpoint
 * Provides platform health status and individual health check results
 */

import { NextRequest, NextResponse } from 'next/server';
import { HealthService, HealthServiceConfig } from '../../../../services/health-service';
import { MetricsCollectorManager } from '../../../../lib/monitoring/collectors';
import { InMemoryMetricsStorage } from '../../../../lib/monitoring/storage';

// Initialize services (in a real app, these would be properly dependency injected)
const storage = new InMemoryMetricsStorage();
const metricsManager = new MetricsCollectorManager(storage);
const healthServiceConfig: HealthServiceConfig = {
  checkInterval: 30,
  timeout: 5000,
  retries: 3,
  enabledChecks: ['database', 'redis', 'external_apis', 'disk_space', 'memory_usage']
};
const healthService = new HealthService(healthServiceConfig, metricsManager);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get('check');

    // Start health checking if not already running
    if (!healthService.isHealthCheckingActive()) {
      healthService.startHealthChecking();
    }

    if (check) {
      // Get specific health check
      const healthCheck = await healthService.runHealthCheck(check);
      return NextResponse.json({
        success: true,
        data: healthCheck
      });
    } else {
      // Get overall health status
      const healthStatus = await healthService.runAllHealthChecks();
      return NextResponse.json({
        success: true,
        data: healthStatus
      });
    }

  } catch (error) {
    console.error('Health check API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error.message || 'Failed to perform health check'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, checkName, config } = body;

    switch (action) {
      case 'start_monitoring':
        healthService.startHealthChecking();
        return NextResponse.json({
          success: true,
          message: 'Health monitoring started'
        });

      case 'stop_monitoring':
        healthService.stopHealthChecking();
        return NextResponse.json({
          success: true,
          message: 'Health monitoring stopped'
        });

      case 'add_check':
        if (!config || !config.name) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CONFIG',
                message: 'Health check configuration is required'
              }
            },
            { status: 400 }
          );
        }
        healthService.addHealthCheck(config);
        return NextResponse.json({
          success: true,
          message: `Health check '${config.name}' added`
        });

      case 'remove_check':
        if (!checkName) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CHECK_NAME',
                message: 'Check name is required'
              }
            },
            { status: 400 }
          );
        }
        healthService.removeHealthCheck(checkName);
        return NextResponse.json({
          success: true,
          message: `Health check '${checkName}' removed`
        });

      case 'run_check':
        if (!checkName) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CHECK_NAME',
                message: 'Check name is required'
              }
            },
            { status: 400 }
          );
        }
        const result = await healthService.runHealthCheck(checkName);
        return NextResponse.json({
          success: true,
          data: result
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
    console.error('Health management API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_MANAGEMENT_ERROR',
          message: error.message || 'Failed to manage health checks'
        }
      },
      { status: 500 }
    );
  }
}