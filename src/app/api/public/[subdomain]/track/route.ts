/**
 * Public Page View Tracking API
 * Epic 7: Story 7.2 - Website Analytics Tracking
 *
 * POST /api/public/[subdomain]/track - Track page view
 */

import { NextRequest, NextResponse } from 'next/server';
import { websiteAnalyticsService } from '@/services/analytics-service/website-analytics.service';
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

    if (!body.path || !body.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: path, sessionId' },
        { status: 400 }
      );
    }

    const pageView = await websiteAnalyticsService.trackPageView(
      branding.tenantId,
      body
    );

    return NextResponse.json({ success: true, id: pageView.id });
  } catch (error: any) {
    console.error('Track page view error:', error);
    return NextResponse.json(
      { error: 'Failed to track page view', details: error.message },
      { status: 500 }
    );
  }
}
