import { NextRequest, NextResponse } from 'next/server';
import { TenantService } from '@/services/tenant-service';
import { withAdminAuth } from '@/lib/middleware/admin-auth';

// Initialize tenant service
const tenantService = new TenantService();

interface Params {
  id: string;
}

/**
 * GET /api/admin/tenants/[id]/health - Get tenant health status
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

    // Get tenant health status
    const healthStatus = await tenantService.getTenantHealth(id);

    if (!healthStatus) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    console.error('Failed to fetch tenant health:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tenant health',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tenants/[id]/health/check - Trigger health check
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

    // Trigger health check
    const healthStatus = await tenantService.checkTenantHealth(id);

    if (!healthStatus) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: healthStatus,
      message: 'Health check completed'
    });

  } catch (error) {
    console.error('Failed to check tenant health:', error);
    return NextResponse.json(
      {
        error: 'Failed to check tenant health',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}