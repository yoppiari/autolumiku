/**
 * Status Management API
 * Epic 4: Story 4.6 - Vehicle Status Workflow
 *
 * PUT /api/v1/inventory/status/:vehicleId - Change vehicle status
 * GET /api/v1/inventory/status/:vehicleId - Get status history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { statusWorkflowService } from '@/services/inventory/status-workflow.service';

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const vehicleId = params?.vehicleId as string;
    const body = await request.json();
    const { status, reason, metadata } = body;

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: status',
        },
        { status: 400 }
      );
    }

    const result = await statusWorkflowService.changeStatus(
      vehicleId,
      status,
      user.tenantId,
      user.id,
      `${user.firstName} ${user.lastName}`,
      reason,
      metadata
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.vehicle,
    });
  } catch (error) {
    console.error('[Status API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to change status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async (request, { user, params }) => {
  try {
    const vehicleId = params?.vehicleId as string;

    const history = await statusWorkflowService.getTransitionHistory(vehicleId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[Status History API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get status history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
