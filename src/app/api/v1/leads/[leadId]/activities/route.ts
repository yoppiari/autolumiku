/**
 * Lead Activities API
 * Epic 6: Story 6.4 - Lead Activity Tracking
 *
 * GET /api/v1/leads/[leadId]/activities - Get all activities for lead
 * POST /api/v1/leads/[leadId]/activities - Record new activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadActivityService } from '@/services/lead/lead-activity.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const { searchParams } = new URL(request.url);

      const filters: any = {};

      if (searchParams.get('type')) {
        filters.type = searchParams.get('type');
      }

      if (searchParams.get('channel')) {
        filters.channel = searchParams.get('channel');
      }

      if (searchParams.get('dateFrom')) {
        filters.dateFrom = new Date(searchParams.get('dateFrom')!);
      }

      if (searchParams.get('dateTo')) {
        filters.dateTo = new Date(searchParams.get('dateTo')!);
      }

      const activities = await leadActivityService.getActivities(
        leadId,
        user.tenantId,
        filters
      );

      return NextResponse.json({ activities });
    } catch (error: any) {
      console.error('Get activities error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activities', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const body = await request.json();

      const activity = await leadActivityService.recordActivity(
        leadId,
        user.tenantId,
        {
          ...body,
          performedBy: user.id,
          performedByName: `${user.firstName} ${user.lastName}`,
        }
      );

      return NextResponse.json(activity, { status: 201 });
    } catch (error: any) {
      console.error('Record activity error:', error);
      return NextResponse.json(
        { error: 'Failed to record activity', details: error.message },
        { status: 500 }
      );
    }
  }
);
