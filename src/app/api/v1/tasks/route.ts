/**
 * User Tasks API
 * Epic 6: Story 6.5 - Task Dashboard
 *
 * GET /api/v1/tasks - Get tasks for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadTaskService } from '@/services/lead/lead-task.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);

    const filters: any = {};

    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }

    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }

    if (searchParams.get('priority')) {
      filters.priority = searchParams.get('priority');
    }

    const tasks = await leadTaskService.getUserTasks(
      user.tenantId,
      user.id,
      filters
    );

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('Get user tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    );
  }
});
