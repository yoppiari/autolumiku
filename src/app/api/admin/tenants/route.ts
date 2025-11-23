import { NextRequest, NextResponse } from 'next/server';
import { TenantService } from '@/services/tenant-service';
import { CreateTenantRequest, UpdateTenantRequest } from '@/types/tenant';
import { withAdminAuth, AdminJWT } from '@/lib/middleware/admin-auth';
import crypto from 'crypto';

// Initialize tenant service
const tenantService = new TenantService();

/**
 * GET /api/admin/tenants - List all tenants
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Re-enable admin authentication in production
    // Temporarily disabled for development
    // const admin = await withAdminAuth(request);
    // if (!admin) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Get tenants with filters
    const result = await tenantService.getAllTenants({
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
    // TODO: Re-enable admin authentication in production
    // Temporarily disabled for development
    // const admin = await withAdminAuth(request);
    // if (!admin) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // Parse request body
    const body = await request.json();

    // Generate password if auto-generate is enabled or no password provided
    let adminPassword = body.adminPassword;
    if (body.autoGeneratePassword || !adminPassword) {
      // Generate secure random password
      const length = 12;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      adminPassword = '';
      for (let i = 0; i < length; i++) {
        adminPassword += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }

    // Map request body to service CreateTenantRequest format
    const createTenantData = {
      name: body.name,
      slug: body.subdomain, // Map subdomain to slug
      domain: body.customDomain && body.customDomain.trim() ? body.customDomain.trim() : null, // Custom domain
      industry: body.industry || '',
      adminUser: {
        email: body.adminUser.email,
        password: adminPassword, // Use generated or provided password
        firstName: body.adminUser.firstName,
        lastName: body.adminUser.lastName,
      }
    };

    // Validate required fields
    if (!createTenantData.name?.trim()) {
      return NextResponse.json(
        { error: 'Tenant name is required' },
        { status: 400 }
      );
    }

    if (!createTenantData.slug?.trim()) {
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
    console.log('Creating tenant with data:', createTenantData);
    const result = await tenantService.createTenant(createTenantData);
    console.log('Tenant creation result:', result);

    // Check if creation was successful
    if (!result.success || !result.tenant) {
      return NextResponse.json(
        { error: result.message || 'Failed to create tenant' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.tenant,
      message: `Tenant "${result.tenant.name}" created successfully`
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