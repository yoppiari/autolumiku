/**
 * Tenant Management API Routes
 * Epic 1: Story 1.5 - Tenant CRUD APIs
 *
 * Endpoints:
 * - POST   /api/v1/tenants          - Create new tenant
 * - GET    /api/v1/tenants          - List all tenants (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { withPermission } from '@/middleware/rbac';
import { tenantService } from '@/services/tenant-service';

/**
 * POST /api/v1/tenants
 * Create a new tenant with admin user
 */
export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.subdomain || !body.adminUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          message: 'name, subdomain, and adminUser are required',
        },
        { status: 400 }
      );
    }

    if (!body.adminUser.email || !body.adminUser.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin user',
          message: 'adminUser.email and adminUser.password are required',
        },
        { status: 400 }
      );
    }

    // Create tenant
    const result = await tenantService.createTenant({
      name: body.name,
      subdomain: body.subdomain,
      industry: body.industry,
      adminUser: {
        email: body.adminUser.email,
        password: body.adminUser.password,
        firstName: body.adminUser.firstName || 'Admin',
        lastName: body.adminUser.lastName || 'User',
      },
      subscription: body.subscription,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant creation failed',
          message: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenant: result.tenant,
          adminUser: result.adminUser,
        },
        message: result.message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create tenant API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to create tenant',
      },
      { status: 500 }
    );
  }
};

/**
 * GET /api/v1/tenants
 * List all tenants (admin only)
 */
export const GET = withAuth(
  withPermission(
    { permissions: 'tenant:read', requireAll: true },
    async (request, { user }) => {
      try {
        const { searchParams } = request.nextUrl;

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || undefined;
        const status = (searchParams.get('status') as 'active' | 'inactive') || undefined;

        const result = await tenantService.getAllTenants({
          page,
          limit,
          search,
          status,
        });

        return NextResponse.json({
          success: true,
          data: result.tenants,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit),
          },
        });
      } catch (error) {
        console.error('List tenants API error:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Internal server error',
            message: 'Failed to list tenants',
          },
          { status: 500 }
        );
      }
    }
  )
);
