/**
 * Feedback Response API
 * Epic 7: Story 7.8 - Respond to Feedback
 *
 * POST /api/v1/feedback/[feedbackId]/respond - Respond to feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { feedbackAnalyticsService } from '@/services/analytics-service/feedback-analytics.service';

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { feedbackId: string } }) => {
    try {
      const { feedbackId } = params;
      const body = await request.json();

      if (!body.response) {
        return NextResponse.json(
          { error: 'Missing required field: response' },
          { status: 400 }
        );
      }

      const feedback = await feedbackAnalyticsService.respondToFeedback(
        feedbackId,
        user.tenantId,
        body.response,
        user.id
      );

      return NextResponse.json(feedback);
    } catch (error: any) {
      console.error('Respond to feedback error:', error);
      return NextResponse.json(
        { error: 'Failed to respond to feedback', details: error.message },
        { status: 500 }
      );
    }
  }
);
