/**
 * Tenant Context Middleware
 * Epic 1: Story 1.4 - Tenant Isolation & Data Segregation
 *
 * Ensures strict tenant isolation by validating that users can only
 * access data from their own tenant. Provides tenant context injection
 * and automatic tenant filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { JWTPayload } from './auth';
import { prisma } from '@/lib/prisma';
import { SystemRoles } from '@/services/rbac-service';

/**
 * Tenant context for use in requests
 */
export interface TenantContext {
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  canAccessAllTenants: boolean; // true for super/platform admins
}

/**
 * Extract tenant ID from various request sources
 */
export async function extractTenantIdFromRequest(request: NextRequest): Promise<string | null> {
  // 1. Try URL path params (e.g., /api/tenants/:tenantId/...)
  const pathMatch = request.nextUrl.pathname.match(/\/tenants\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  // 2. Try query params
  const queryTenantId = request.nextUrl.searchParams.get('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  // 3. Try request body (for POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      // Clone the request to read body without consuming it
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      if (body.tenantId) {
        return body.tenantId;
      }
    } catch {
      // Body not JSON or empty, continue
    }
  }

  // 4. Try custom header
  const headerTenantId = request.headers.get('x-tenant-id');
  if (headerTenantId) {
    return headerTenantId;
  }

  return null;
}

/**
 * Get tenant context for authenticated user
 */
export async function getTenantContext(
  user: JWTPayload,
  requestedTenantId?: string | null
): Promise<{ context: TenantContext | null; error: NextResponse | null }> {
  try {
    // Determine which tenant to use
    let targetTenantId: string;

    // Check if user can access all tenants (super/platform admin)
    const canAccessAllTenants =
      user.role === SystemRoles.SUPER_ADMIN ||
      user.role === SystemRoles.PLATFORM_ADMIN ||
      user.role === 'admin';

    if (requestedTenantId) {
      // Validate access to requested tenant
      if (!canAccessAllTenants && requestedTenantId !== user.tenantId) {
        return {
          context: null,
          error: NextResponse.json(
            {
              success: false,
              error: 'Tenant access denied',
              message: 'You do not have permission to access this tenant',
              requested: requestedTenantId,
              userTenant: user.tenantId,
            },
            { status: 403 }
          ),
        };
      }
      targetTenantId = requestedTenantId;
    } else {
      // Use user's tenant
      targetTenantId = user.tenantId;
    }

    // Get tenant details
    const tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    if (!tenant) {
      return {
        context: null,
        error: NextResponse.json(
          {
            success: false,
            error: 'Tenant not found',
            message: 'The requested tenant does not exist',
          },
          { status: 404 }
        ),
      };
    }

    // Check if tenant is active
    if (tenant.status !== 'active' && !canAccessAllTenants) {
      return {
        context: null,
        error: NextResponse.json(
          {
            success: false,
            error: 'Tenant inactive',
            message: 'This tenant account is currently inactive',
          },
          { status: 403 }
        ),
      };
    }

    return {
      context: {
        tenantId: tenant.id,
        tenant,
        canAccessAllTenants,
      },
      error: null,
    };
  } catch (error) {
    console.error('Get tenant context failed:', error);
    return {
      context: null,
      error: NextResponse.json(
        {
          success: false,
          error: 'Tenant context failed',
          message: 'Failed to establish tenant context',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Middleware to require tenant context
 * Use this after requireAuth to ensure tenant isolation
 *
 * Usage in API route:
 * const authResult = await requireAuth(request);
 * if (authResult instanceof NextResponse) return authResult;
 *
 * const tenantResult = await requireTenantContext(request, authResult.user);
 * if (tenantResult.error) return tenantResult.error;
 *
 * const { tenantId } = tenantResult.context;
 */
export async function requireTenantContext(
  request: NextRequest,
  user: JWTPayload
): Promise<{ context: TenantContext | null; error: NextResponse | null }> {
  const requestedTenantId = await extractTenantIdFromRequest(request);
  return getTenantContext(user, requestedTenantId);
}

/**
 * Higher-order function to wrap handlers with tenant context
 *
 * Usage:
 * export const GET = withAuth(
 *   withTenantContext(async (request, { user, tenant }) => {
 *     // user is authenticated, tenant context is established
 *     // Only data from tenant.tenantId will be accessible
 *     return NextResponse.json({ tenantId: tenant.tenantId });
 *   })
 * );
 */
export function withTenantContext(
  handler: (
    request: NextRequest,
    context: { user: JWTPayload; tenant: TenantContext }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { user: JWTPayload }
  ): Promise<NextResponse> => {
    const tenantResult = await requireTenantContext(request, context.user);

    if (tenantResult.error) {
      return tenantResult.error;
    }

    if (!tenantResult.context) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant context missing',
        },
        { status: 500 }
      );
    }

    return handler(request, {
      user: context.user,
      tenant: tenantResult.context,
    });
  };
}

/**
 * Combined auth + tenant context wrapper
 * Convenience function that combines authentication and tenant context
 *
 * Usage:
 * export const GET = withAuthAndTenant(async (request, { user, tenant }) => {
 *   // user is authenticated, tenant context established
 *   const vehicles = await prisma.vehicle.findMany({
 *     where: { tenantId: tenant.tenantId }
 *   });
 *   return NextResponse.json({ vehicles });
 * });
 */
export function withAuthAndTenant(
  handler: (
    request: NextRequest,
    context: { user: JWTPayload; tenant: TenantContext }
  ) => Promise<NextResponse>
) {
  // Import withAuth dynamically to avoid circular dependency
  const { withAuth } = require('./auth');

  return withAuth(withTenantContext(handler));
}

/**
 * Validate that a resource belongs to the tenant
 * Helper function for additional tenant isolation checks
 */
export async function validateResourceTenant(
  resourceTable: string,
  resourceId: string,
  expectedTenantId: string
): Promise<{ valid: boolean; error: NextResponse | null }> {
  try {
    // Using dynamic table name with Prisma is not ideal,
    // but we can use raw query for validation
    const result: any = await prisma.$queryRawUnsafe(
      `SELECT tenant_id FROM ${resourceTable} WHERE id = $1 LIMIT 1`,
      resourceId
    );

    if (result.length === 0) {
      return {
        valid: false,
        error: NextResponse.json(
          {
            success: false,
            error: 'Resource not found',
          },
          { status: 404 }
        ),
      };
    }

    if (result[0].tenant_id !== expectedTenantId) {
      return {
        valid: false,
        error: NextResponse.json(
          {
            success: false,
            error: 'Access denied',
            message: 'This resource belongs to a different tenant',
          },
          { status: 403 }
        ),
      };
    }

    return { valid: true, error: null };
  } catch (error) {
    console.error('Resource tenant validation failed:', error);
    return {
      valid: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Automatically inject tenant context into Prisma queries
 * Extension for Prisma client to auto-filter by tenantId
 *
 * Usage:
 * const prismaWithTenant = addTenantFilter(prisma, tenantId);
 * const vehicles = await prismaWithTenant.vehicle.findMany();
 * // Automatically filters WHERE tenantId = '...'
 */
export function addTenantFilter(tenantId: string) {
  return {
    vehicle: {
      findMany: (args: any = {}) =>
        prisma.vehicle.findMany({
          ...args,
          where: {
            ...args.where,
            tenantId,
          },
        }),
      findFirst: (args: any = {}) =>
        prisma.vehicle.findFirst({
          ...args,
          where: {
            ...args.where,
            tenantId,
          },
        }),
      findUnique: (args: any) =>
        prisma.vehicle.findFirst({
          where: {
            ...args.where,
            tenantId,
          },
        }),
      count: (args: any = {}) =>
        prisma.vehicle.count({
          ...args,
          where: {
            ...args.where,
            tenantId,
          },
        }),
      create: (args: any) =>
        prisma.vehicle.create({
          ...args,
          data: {
            ...args.data,
            tenantId,
          },
        }),
      update: (args: any) =>
        prisma.vehicle.updateMany({
          ...args,
          where: {
            ...args.where,
            tenantId,
          },
        }),
      delete: (args: any) =>
        prisma.vehicle.deleteMany({
          where: {
            ...args.where,
            tenantId,
          },
        }),
    },
    // Add more models as needed
  };
}

/**
 * Get user's tenant with subscription info
 */
export async function getUserTenantWithSubscription(userId: string): Promise<{
  tenant: any;
  subscription: any;
  isActive: boolean;
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            subscriptions: {
              where: {
                status: {
                  in: ['active', 'trialing'],
                },
              },
              orderBy: {
                startDate: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!user || !user.tenant) {
      return null;
    }

    const activeSubscription = user.tenant.subscriptions[0] || null;

    return {
      tenant: user.tenant,
      subscription: activeSubscription,
      isActive: user.tenant.status === 'active' && (activeSubscription !== null),
    };
  } catch (error) {
    console.error('Get user tenant with subscription failed:', error);
    return null;
  }
}
