/**
 * Lead Management API
 * Epic 5: Story 5.5 - Lead Management
 *
 * GET /api/v1/leads - Get all leads with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadService } from '@/services/catalog/lead.service';
import { LeadStatus, LeadPriority } from '@prisma/client';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters: any = {};

    if (searchParams.get('status')) {
      filters.status = searchParams.get('status') as LeadStatus;
    }

    if (searchParams.get('priority')) {
      filters.priority = searchParams.get('priority') as LeadPriority;
    }

    if (searchParams.get('assignedTo')) {
      filters.assignedTo = searchParams.get('assignedTo');
    }

    if (searchParams.get('vehicleId')) {
      filters.vehicleId = searchParams.get('vehicleId');
    }

    if (searchParams.get('dateFrom')) {
      filters.dateFrom = new Date(searchParams.get('dateFrom')!);
    }

    if (searchParams.get('dateTo')) {
      filters.dateTo = new Date(searchParams.get('dateTo')!);
    }

    // Parse pagination
    const options = {
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!)
        : 1,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 20,
    };

    const result = await leadService.getLeads(user.tenantId, filters, options);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Get leads error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: error.message },
      { status: 500 }
    );
  }
});
