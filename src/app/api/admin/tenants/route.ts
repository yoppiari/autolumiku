import { NextRequest, NextResponse } from 'next/server';
import { TenantService } from '@/services/tenant-service';
import { CreateTenantRequest, UpdateTenantRequest } from '@/types/tenant';
import { withAdminAuth, AdminJWT } from '@/lib/middleware/admin-auth';

// Initialize tenant service
const tenantService = new TenantService();

/**
 * GET /api/admin/tenants - List all tenants
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Get tenants with filters
    const result = await tenantService.getTenants({
      page,
      limit,
      status: status as any,
      search
    });

    return NextResponse.json({
      success: true,
      data: result.tenants,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });

  } catch (error) {
    console.error('Failed to fetch tenants:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tenants',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tenants - Create new tenant
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const createTenantData: CreateTenantRequest = {
      name: body.name,
      subdomain: body.subdomain,
      adminUser: {
        email: body.adminUser.email,
        firstName: body.adminUser.firstName,
        lastName: body.adminUser.lastName,
        phone: body.adminUser.phone
      },
      settings: body.settings || {}
    };

    // Validate required fields
    if (!createTenantData.name?.trim()) {
      return NextResponse.json(
        { error: 'Tenant name is required' },
        { status: 400 }
      );
    }

    if (!createTenantData.subdomain?.trim()) {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    if (!createTenantData.adminUser?.email?.trim()) {
      return NextResponse.json(
        { error: 'Admin user email is required' },
        { status: 400 }
      );
    }

    // Create tenant
    const tenant = await tenantService.createTenant(createTenantData);

    return NextResponse.json({
      success: true,
      data: tenant,
      message: `Tenant "${tenant.name}" created successfully`
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create tenant:', error);

    // Handle specific validation errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Subdomain already exists' },
          { status: 409 }
        );
      }
      if (error.message.includes('Invalid')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}