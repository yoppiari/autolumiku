/**
 * Marketing Campaigns API
 * Epic 7: Story 7.5 - Campaign Management
 *
 * GET /api/v1/campaigns - Get all campaigns
 * POST /api/v1/campaigns - Create campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { marketingAnalyticsService } from '@/services/analytics-service/marketing-analytics.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('channel')) {
      filters.channel = searchParams.get('channel');
    }

    const campaigns = await marketingAnalyticsService.getCampaigns(
      user.tenantId,
      filters
    );

    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    if (!body.name || !body.channel || !body.budget || !body.startDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const campaign = await marketingAnalyticsService.createCampaign(
      user.tenantId,
      {
        ...body,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      }
    );

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) {
    console.error('Create campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error.message },
      { status: 500 }
    );
  }
});
