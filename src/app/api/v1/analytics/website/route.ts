/**
 * Website Analytics API
 * Epic 7: Story 7.2 - Website Traffic Analytics
 *
 * POST /api/v1/analytics/website - Get website analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { websiteAnalyticsService } from '@/services/analytics-service/website-analytics.service';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = body.dateTo ? new Date(body.dateTo) : new Date();

    const analytics = await websiteAnalyticsService.getWebsiteAnalytics(
      user.tenantId,
      dateFrom,
      dateTo
    );

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Website analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch website analytics', details: error.message },
      { status: 500 }
    );
  }
});
