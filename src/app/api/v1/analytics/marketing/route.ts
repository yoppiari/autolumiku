/**
 * Marketing Analytics API
 * Epic 7: Story 7.5 - Marketing Campaign Performance
 *
 * POST /api/v1/analytics/marketing - Get marketing analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { marketingAnalyticsService } from '@/services/analytics-service/marketing-analytics.service';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = body.dateTo ? new Date(body.dateTo) : new Date();

    const [campaigns, channelPerf, recommendations] = await Promise.all([
      marketingAnalyticsService.compareCampaigns(user.tenantId, dateFrom, dateTo),
      marketingAnalyticsService.getChannelPerformance(user.tenantId, dateFrom, dateTo),
      marketingAnalyticsService.getCampaignRecommendations(user.tenantId),
    ]);

    return NextResponse.json({
      campaigns,
      channelPerformance: channelPerf,
      recommendations,
    });
  } catch (error: any) {
    console.error('Marketing analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketing analytics', details: error.message },
      { status: 500 }
    );
  }
});
