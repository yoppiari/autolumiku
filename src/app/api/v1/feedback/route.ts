/**
 * Customer Feedback API
 * Epic 7: Story 7.8 - Feedback Management
 *
 * GET /api/v1/feedback - Get all feedback
 * POST /api/v1/feedback - Submit feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { feedbackAnalyticsService } from '@/services/analytics-service/feedback-analytics.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);

    const filters: any = {};

    if (searchParams.get('rating')) {
      filters.rating = parseInt(searchParams.get('rating')!);
    }

    if (searchParams.get('category')) {
      filters.category = searchParams.get('category');
    }

    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }

    if (searchParams.get('dateFrom')) {
      filters.dateFrom = new Date(searchParams.get('dateFrom')!);
    }

    if (searchParams.get('dateTo')) {
      filters.dateTo = new Date(searchParams.get('dateTo')!);
    }

    const feedback = await feedbackAnalyticsService.getAllFeedback(
      user.tenantId,
      filters
    );

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('Get feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: error.message },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    if (!body.rating || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: rating, category' },
        { status: 400 }
      );
    }

    const feedback = await feedbackAnalyticsService.submitFeedback(
      user.tenantId,
      body
    );

    return NextResponse.json(feedback, { status: 201 });
  } catch (error: any) {
    console.error('Submit feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error.message },
      { status: 500 }
    );
  }
});
