/**
 * Campaign Management API
 * Epic 7: Story 7.5 - Campaign CRUD
 *
 * GET /api/v1/campaigns/[campaignId] - Get campaign
 * PUT /api/v1/campaigns/[campaignId] - Update campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { marketingAnalyticsService } from '@/services/analytics-service/marketing-analytics.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { campaignId: string } }) => {
    try {
      const { campaignId } = params;

      const performance = await marketingAnalyticsService.getCampaignPerformance(
        campaignId,
        user.tenantId
      );

      if (!performance) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      return NextResponse.json(performance);
    } catch (error: any) {
      console.error('Get campaign error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch campaign', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const PUT = withAuth(
  async (request, { user, params }: { user: any; params: { campaignId: string } }) => {
    try {
      const { campaignId } = params;
      const body = await request.json();

      const campaign = await marketingAnalyticsService.updateCampaign(
        campaignId,
        user.tenantId,
        body
      );

      return NextResponse.json(campaign);
    } catch (error: any) {
      console.error('Update campaign error:', error);
      return NextResponse.json(
        { error: 'Failed to update campaign', details: error.message },
        { status: 500 }
      );
    }
  }
);
