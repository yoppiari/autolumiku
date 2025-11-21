import { NextRequest, NextResponse } from 'next/server';
import { TenantCreationWorkflowService } from '@/services/tenant-service/workflows';
import { withAdminAuth } from '@/lib/middleware/admin-auth';

// Initialize workflow service
const workflowService = new TenantCreationWorkflowService();

interface Params {
  id: string;
}

/**
 * POST /api/admin/tenants/[id]/provision - Trigger tenant reprovisioning
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Parse request body for specific provisioning steps
    const body = await request.json();
    const steps = body.steps; // Optional: specific steps to reprovision

    // Start provisioning workflow
    const workflowResult = await workflowService.executeWorkflow(id, {
      triggerReprovision: true,
      specificSteps: steps
    });

    return NextResponse.json({
      success: true,
      data: {
        workflowId: workflowResult.workflowId,
        status: workflowResult.status,
        currentStep: workflowResult.currentStep,
        steps: workflowResult.steps,
        progress: workflowResult.progress
      },
      message: 'Tenant provisioning workflow started'
    });

  } catch (error) {
    console.error('Failed to start tenant provisioning:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('already in progress')) {
        return NextResponse.json(
          { error: 'Provisioning already in progress' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to start tenant provisioning',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tenants/[id]/provision/status - Get provisioning status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get workflow status
    const workflowStatus = await workflowService.getWorkflowStatus(id);

    if (!workflowStatus) {
      return NextResponse.json(
        { error: 'No provisioning workflow found for this tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflowStatus
    });

  } catch (error) {
    console.error('Failed to get provisioning status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get provisioning status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}