/**
 * Lead Management API
 * Epic 5: Story 5.5 - Lead CRUD
 *
 * GET /api/v1/leads/[leadId] - Get lead details
 * PUT /api/v1/leads/[leadId] - Update lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadService } from '@/services/catalog/lead.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;

      const lead = await leadService.getLead(leadId, user.tenantId);

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      return NextResponse.json(lead);
    } catch (error: any) {
      console.error('Get lead error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch lead', details: error.message },
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

      const updatedLead = await leadService.updateLead(
        leadId,
        user.tenantId,
        body
      );

      return NextResponse.json(updatedLead);
    } catch (error: any) {
      console.error('Update lead error:', error);
      return NextResponse.json(
        { error: 'Failed to update lead', details: error.message },
        { status: 500 }
      );
    }
  }
);
