/**
 * Feedback Analytics API
 * Epic 7: Story 7.8 - Customer Satisfaction Analytics
 *
 * POST /api/v1/analytics/feedback - Get feedback analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { feedbackAnalyticsService } from '@/services/analytics-service/feedback-analytics.service';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = body.dateTo ? new Date(body.dateTo) : new Date();

    const [analytics, nps, issues] = await Promise.all([
      feedbackAnalyticsService.getFeedbackAnalytics(user.tenantId, dateFrom, dateTo),
      feedbackAnalyticsService.getSatisfactionScore(user.tenantId, dateFrom, dateTo),
      feedbackAnalyticsService.getCommonIssues(user.tenantId, dateFrom, dateTo),
    ]);

    return NextResponse.json({
      ...analytics,
      nps,
      commonIssues: issues,
    });
  } catch (error: any) {
    console.error('Feedback analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback analytics', details: error.message },
      { status: 500 }
    );
  }
});
