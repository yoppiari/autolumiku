/**
 * Lead Scoring API
 * Epic 6: Story 6.3 - Lead Scoring
 *
 * GET /api/v1/leads/[leadId]/score - Get lead score
 * POST /api/v1/leads/[leadId]/score - Recalculate score
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadScoringService } from '@/services/lead/lead-scoring.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;

      const score = await leadScoringService.getLatestScore(
        leadId,
        user.tenantId
      );

      if (!score) {
        return NextResponse.json({ error: 'Score not found' }, { status: 404 });
      }

      return NextResponse.json(score);
    } catch (error: any) {
      console.error('Get score error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch score', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;

      const score = await leadScoringService.calculateLeadScore(
        leadId,
        user.tenantId
      );

      return NextResponse.json(score);
    } catch (error: any) {
      console.error('Calculate score error:', error);
      return NextResponse.json(
        { error: 'Failed to calculate score', details: error.message },
        { status: 500 }
      );
    }
  }
);
