/**
 * Task Statistics API
 * Epic 6: Story 6.5 - Task Analytics
 *
 * GET /api/v1/tasks/stats - Get task statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadTaskService } from '@/services/lead/lead-task.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const stats = await leadTaskService.getUserTaskStats(user.tenantId, user.id);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Get task stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task statistics', details: error.message },
      { status: 500 }
    );
  }
});
