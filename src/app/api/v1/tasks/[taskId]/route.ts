/**
 * Task API
 * Epic 6: Story 6.5 - Task CRUD
 *
 * PUT /api/v1/tasks/[taskId] - Update task
 * DELETE /api/v1/tasks/[taskId] - Delete task
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadTaskService } from '@/services/lead/lead-task.service';

export const PUT = withAuth(
  async (request, { user, params }: { user: any; params: { taskId: string } }) => {
    try {
      const { taskId } = params;
      const body = await request.json();

      const task = await leadTaskService.updateTask(taskId, user.tenantId, body);

      return NextResponse.json(task);
    } catch (error: any) {
      console.error('Update task error:', error);
      return NextResponse.json(
        { error: 'Failed to update task', details: error.message },
        { status: 500 }
      );
    }
  }
);
