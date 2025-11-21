/**
 * Lead Activity Timeline API
 * Epic 6: Story 6.4 - Activity Timeline View
 *
 * GET /api/v1/leads/[leadId]/activities/timeline - Get activity timeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadActivityService } from '@/services/lead/lead-activity.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;

      const timeline = await leadActivityService.getActivityTimeline(
        leadId,
        user.tenantId
      );

      return NextResponse.json({ timeline });
    } catch (error: any) {
      console.error('Get timeline error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch timeline', details: error.message },
        { status: 500 }
      );
    }
  }
);
