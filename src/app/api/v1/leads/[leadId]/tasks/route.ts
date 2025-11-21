/**
 * Lead Tasks API
 * Epic 6: Story 6.5 - Task Management
 *
 * GET /api/v1/leads/[leadId]/tasks - Get tasks for lead
 * POST /api/v1/leads/[leadId]/tasks - Create new task
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { leadTaskService } from '@/services/lead/lead-task.service';

export const GET = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
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

      if (searchParams.get('assignedTo')) {
        filters.assignedTo = searchParams.get('assignedTo');
      }

      const tasks = await leadTaskService.getLeadTasks(
        leadId,
        user.tenantId,
        filters
      );

      return NextResponse.json({ tasks });
    } catch (error: any) {
      console.error('Get tasks error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tasks', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { leadId: string } }) => {
    try {
      const { leadId } = params;
      const body = await request.json();

      if (!body.title || !body.type || !body.dueDate || !body.assignedTo) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const task = await leadTaskService.createTask(leadId, user.tenantId, {
        ...body,
        dueDate: new Date(body.dueDate),
        reminderDate: body.reminderDate ? new Date(body.reminderDate) : undefined,
      });

      return NextResponse.json(task, { status: 201 });
    } catch (error: any) {
      console.error('Create task error:', error);
      return NextResponse.json(
        { error: 'Failed to create task', details: error.message },
        { status: 500 }
      );
    }
  }
);
