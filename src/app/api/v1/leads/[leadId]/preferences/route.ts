/**
 * Communication Preferences API
 * Epic 6: Story 6.6 - Customer Preferences
 *
 * GET /api/v1/leads/[leadId]/preferences - Get preferences
 * PUT /api/v1/leads/[leadId]/preferences - Update preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { communicationService } from '@/services/lead/communication.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;

      const preference = await communicationService.getOrCreatePreference(
        leadId,
        user.tenantId
      );

      return NextResponse.json(preference);
    } catch (error: any) {
      console.error('Get preferences error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const PUT = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const body = await request.json();

      const preference = await communicationService.updatePreferences(
        leadId,
        user.tenantId,
        body
      );

      return NextResponse.json(preference);
    } catch (error: any) {
      console.error('Update preferences error:', error);
      return NextResponse.json(
        { error: 'Failed to update preferences', details: error.message },
        { status: 500 }
      );
    }
  }
);
