/**
 * Lead Assignment API
 * Epic 5: Story 5.5 - Lead Assignment
 *
 * POST /api/v1/leads/[leadId]/assign - Assign lead to user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadService } from '@/services/catalog/lead.service';

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const body = await request.json();

      if (!body.userId) {
        return NextResponse.json(
          { error: 'Missing required field: userId' },
          { status: 400 }
        );
      }

      const updatedLead = await leadService.assignLead(
        leadId,
        user.tenantId,
        body.userId
      );

      return NextResponse.json(updatedLead);
    } catch (error: any) {
      console.error('Assign lead error:', error);
      return NextResponse.json(
        { error: 'Failed to assign lead', details: error.message },
        { status: 500 }
      );
    }
  }
);
