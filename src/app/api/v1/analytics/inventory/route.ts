/**
 * POST /api/v1/analytics/inventory
 * Epic 7: Get inventory analytics data
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsEngine, inventoryAnalyticsService } from '@/services/analytics-service';
import { TimePeriod, ComparisonPeriod, AnalyticsFilter } from '@/services/analytics-service/types';
import { cacheManager, CACHE_KEYS } from '@/services/analytics-service/cache-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, period = 'month', comparisonPeriod = 'previous' } = body;

    // Validation
    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'tenantId is required',
          },
        },
        { status: 400 }
      );
    }

    // Build filter
    const dateRange = analyticsEngine.getDateRangeFromPeriod(period as TimePeriod);

    const filter: AnalyticsFilter = {
      tenantId,
      dateRange,
      comparisonPeriod: comparisonPeriod as ComparisonPeriod,
    };

    // Try cache
    const cacheKey = CACHE_KEYS.inventoryMetrics(tenantId);
    const data = await cacheManager.getOrSet(
      cacheKey,
      () => inventoryAnalyticsService.getInventoryAnalytics(filter),
      { ttl: 300 } // 5 minutes
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to get inventory analytics:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVENTORY_ANALYTICS_ERROR',
          message: 'Failed to load inventory analytics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
