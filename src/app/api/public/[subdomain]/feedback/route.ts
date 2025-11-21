/**
 * Public Feedback API
 * Epic 7: Story 7.8 - Public Feedback Submission
 *
 * POST /api/public/[subdomain]/feedback - Submit public feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedbackAnalyticsService } from '@/services/analytics-service/feedback-analytics.service';
import { brandingService } from '@/services/catalog/branding.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.rating || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: rating, category' },
        { status: 400 }
      );
    }

    const feedback = await feedbackAnalyticsService.submitFeedback(
      branding.tenantId,
      body
    );

    return NextResponse.json({
      success: true,
      message: 'Terima kasih atas feedback Anda!',
      feedbackId: feedback.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Public feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error.message },
      { status: 500 }
    );
  }
}
