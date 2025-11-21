/**
 * Hot Leads API
 * Epic 5: Story 5.5 - Hot Leads
 *
 * GET /api/v1/leads/hot - Get hot leads (urgent/high priority)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadService } from '@/services/catalog/lead.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 10;

    const hotLeads = await leadService.getHotLeads(user.tenantId, limit);

    return NextResponse.json({ leads: hotLeads });
  } catch (error: any) {
    console.error('Get hot leads error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hot leads', details: error.message },
      { status: 500 }
    );
  }
});
