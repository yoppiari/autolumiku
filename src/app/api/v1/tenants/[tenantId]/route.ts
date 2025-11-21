/**
 * Tenant Management API Routes (Individual Tenant)
 * Epic 1: Story 1.5 - Tenant CRUD APIs
 *
 * Endpoints:
 * - GET    /api/v1/tenants/:tenantId    - Get tenant details
 * - PATCH  /api/v1/tenants/:tenantId    - Update tenant
 * - DELETE /api/v1/tenants/:tenantId    - Delete tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { withTenantContext } from '@/middleware/tenant-context';
import { tenantService } from '@/services/tenant-service';

/**
 * GET /api/v1/tenants/:tenantId
 * Get tenant details with subscription info
 */
export const GET = withAuth(
  withTenantContext(async (request, { user, tenant }) => {
    try {
      const tenantData = await tenantService.getTenant(tenant.tenantId);

      if (!tenantData) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant not found',
          },
          { status: 404 }
        );
      }

      // Get statistics
      const stats = await tenantService.getTenantStats(tenant.tenantId);

      return NextResponse.json({
        success: true,
        data: {
          ...tenantData,
          stats,
        },
      });
    } catch (error) {
      console.error('Get tenant API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: 'Failed to get tenant',
        },
        { status: 500 }
      );
    }
  })
);

/**
 * PATCH /api/v1/tenants/:tenantId
 * Update tenant information
 */
export const PATCH = withAuth(
  withTenantContext(async (request, { user, tenant }) => {
    try {
      const body = await request.json();

      const result = await tenantService.updateTenant(tenant.tenantId, {
        name: body.name,
        subdomain: body.subdomain,
        industry: body.industry,
        logoUrl: body.logoUrl,
        settings: body.settings,
        isActive: body.isActive,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Update failed',
            message: result.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.tenant,
        message: result.message,
      });
    } catch (error) {
      console.error('Update tenant API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: 'Failed to update tenant',
        },
        { status: 500 }
      );
    }
  })
);

/**
 * DELETE /api/v1/tenants/:tenantId
 * Deactivate or permanently delete tenant
 */
export const DELETE = withAuth(
  withTenantContext(async (request, { user, tenant }) => {
    try {
      const { searchParams } = request.nextUrl;
      const permanent = searchParams.get('permanent') === 'true';

      let result;
      if (permanent) {
        // Permanent deletion (requires super admin)
        result = await tenantService.deleteTenant(tenant.tenantId);
      } else {
        // Soft delete (deactivate)
        result = await tenantService.deactivateTenant(tenant.tenantId);
      }

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Delete failed',
            message: result.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete tenant API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: 'Failed to delete tenant',
        },
        { status: 500 }
      );
    }
  })
);
