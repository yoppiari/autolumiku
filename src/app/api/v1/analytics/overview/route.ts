/**
 * POST /api/v1/analytics/overview
 * Epic 7: Get dashboard overview with key metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsEngine, dataAggregator } from '@/services/analytics-service';
import { TimePeriod } from '@/services/analytics-service/types';
import { cacheManager, CACHE_KEYS } from '@/services/analytics-service/cache-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, period = 'month' } = body;

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

    // Get date range from period
    const dateRange = analyticsEngine.getDateRangeFromPeriod(period as TimePeriod);

    // Try to get from cache
    const cacheKey = CACHE_KEYS.dashboardOverview(tenantId, period);
    const cached = await cacheManager.get(cacheKey);

    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Get dashboard data
    const overview = await dataAggregator.getDashboardOverview(tenantId, dateRange);

    // Cache for 5 minutes
    await cacheManager.set(cacheKey, overview, { ttl: 300 });

    return NextResponse.json({
      success: true,
      data: overview,
      cached: false,
    });
  } catch (error) {
    console.error('Failed to get dashboard overview:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'OVERVIEW_ERROR',
          message: 'Failed to load dashboard overview',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
