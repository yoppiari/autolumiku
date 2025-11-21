/**
 * Lead Statistics API
 * Epic 5: Story 5.5 - Lead Analytics
 *
 * GET /api/v1/leads/stats - Get lead statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadService } from '@/services/catalog/lead.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const stats = await leadService.getLeadStats(user.tenantId);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Get lead stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead statistics', details: error.message },
      { status: 500 }
    );
  }
});
