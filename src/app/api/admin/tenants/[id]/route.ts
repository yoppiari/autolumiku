import { NextRequest, NextResponse } from 'next/server';
import { TenantService } from '@/services/tenant-service';
import { UpdateTenantRequest } from '@/types/tenant';
import { withAdminAuth } from '@/lib/middleware/admin-auth';

// Initialize tenant service
const tenantService = new TenantService();

interface Params {
  id: string;
}

/**
 * GET /api/admin/tenants/[id] - Get specific tenant
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

    // Get tenant by ID
    const tenant = await tenantService.getTenant(id);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('Failed to fetch tenant:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tenants/[id] - Update tenant
 */
export async function PUT(
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

    // Parse request body
    const body = await request.json();
    const updateData: UpdateTenantRequest = {
      name: body.name,
      settings: body.settings,
      status: body.status
    };

    // Update tenant
    const updatedTenant = await tenantService.updateTenant(id, updateData);

    if (!updatedTenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTenant,
      message: 'Tenant updated successfully'
    });

  } catch (error) {
    console.error('Failed to update tenant:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid status')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tenants/[id] - Delete tenant
 */
export async function DELETE(
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

    // Parse query for force delete (optional)
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    // Delete tenant
    const deleted = await tenantService.deleteTenant(id, forceDelete);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: forceDelete
        ? 'Tenant permanently deleted'
        : 'Tenant marked for deletion'
    });

  } catch (error) {
    console.error('Failed to delete tenant:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Cannot delete')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to delete tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tenants/[id]/suspend - Suspend tenant
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
    const body = await request.json();
    const action = body.action; // 'suspend' or 'activate'

    if (!['suspend', 'activate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Update tenant status
    const updatedTenant = await tenantService.updateTenantStatus(
      id,
      action === 'suspend' ? 'suspended' : 'active'
    );

    if (!updatedTenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTenant,
      message: `Tenant ${action}d successfully`
    });

  } catch (error) {
    console.error('Failed to update tenant status:', error);
    return NextResponse.json(
      {
        error: 'Failed to update tenant status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}