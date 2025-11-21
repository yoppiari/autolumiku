/**
 * Complete Task API
 * Epic 6: Story 6.5 - Mark Task Complete
 *
 * POST /api/v1/tasks/[taskId]/complete - Complete task
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadTaskService } from '@/services/lead/lead-task.service';

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { taskId: string } }) => {
    try {
      const { taskId } = params;
      const body = await request.json();

      const task = await leadTaskService.completeTask(
        taskId,
        user.tenantId,
        user.id,
        body.notes
      );

      return NextResponse.json(task);
    } catch (error: any) {
      console.error('Complete task error:', error);
      return NextResponse.json(
        { error: 'Failed to complete task', details: error.message },
        { status: 500 }
      );
    }
  }
);
