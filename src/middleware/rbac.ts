/**
 * RBAC Middleware
 * Epic 1: Story 1.2 - Multi-Tenancy & RBAC Implementation
 *
 * Next.js middleware for role-based access control and permission checking.
 * Works in conjunction with auth middleware and rbac-service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { JWTPayload } from './auth';
import { rbacService } from '@/services/rbac-service';

/**
 * Permission check options
 */
export interface PermissionOptions {
  permissions: string | string[];
  requireAll?: boolean; // If true, require ALL permissions. If false, require ANY permission.
}

/**
 * Role check options
 */
export interface RoleOptions {
  roles: string | string[];
}

/**
 * Check if user has required permission(s)
 * Use this after requireAuth to check permissions
 */
export async function requirePermission(
  user: JWTPayload,
  options: PermissionOptions
): Promise<NextResponse | null> {
  const permissions = Array.isArray(options.permissions)
    ? options.permissions
    : [options.permissions];

  const requireAll = options.requireAll ?? false;

  let result;
  if (requireAll) {
    result = await rbacService.checkAllPermissions(user.userId, permissions);
  } else {
    result = await rbacService.checkAnyPermission(user.userId, permissions);
  }

  if (!result.hasPermission) {
    return NextResponse.json(
      {
        success: false,
        error: 'Permission denied',
        message: result.reason || 'You do not have the required permissions',
        required: permissions,
        missing: result.missingPermissions,
      },
      { status: 403 }
    );
  }

  return null; // No error, continue
}

/**
 * Check if user has required role(s)
 * Use this after requireAuth to check roles
 */
export async function requireRole(
  user: JWTPayload,
  options: RoleOptions
): Promise<NextResponse | null> {
  const requiredRoles = Array.isArray(options.roles) ? options.roles : [options.roles];

  const userRole = await rbacService.getUserRole(user.userId);

  if (!userRole) {
    return NextResponse.json(
      {
        success: false,
        error: 'Role not found',
        message: 'User role could not be determined',
      },
      { status: 403 }
    );
  }

  const hasRole = requiredRoles.includes(userRole.name);

  if (!hasRole) {
    return NextResponse.json(
      {
        success: false,
        error: 'Role denied',
        message: 'You do not have the required role',
        required: requiredRoles,
        current: userRole.name,
      },
      { status: 403 }
    );
  }

  return null; // No error, continue
}

/**
 * Higher-order function to wrap API handlers with permission check
 *
 * Usage:
 * export const GET = withAuth(
 *   withPermission(['vehicle:read'], async (request, { user }) => {
 *     // user has been authenticated and has vehicle:read permission
 *     return NextResponse.json({ message: 'Access granted' });
 *   })
 * );
 */
export function withPermission(
  options: PermissionOptions,
  handler: (request: NextRequest, context: { user: JWTPayload }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { user: JWTPayload }): Promise<NextResponse> => {
    // Check permissions
    const permissionError = await requirePermission(context.user, options);

    if (permissionError) {
      return permissionError;
    }

    // Permission granted, call handler
    return handler(request, context);
  };
}

/**
 * Higher-order function to wrap API handlers with role check
 *
 * Usage:
 * export const GET = withAuth(
 *   withRole(['admin', 'manager'], async (request, { user }) => {
 *     // user has been authenticated and has admin or manager role
 *     return NextResponse.json({ message: 'Access granted' });
 *   })
 * );
 */
export function withRole(
  options: RoleOptions,
  handler: (request: NextRequest, context: { user: JWTPayload }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { user: JWTPayload }): Promise<NextResponse> => {
    // Check role
    const roleError = await requireRole(context.user, options);

    if (roleError) {
      return roleError;
    }

    // Role check passed, call handler
    return handler(request, context);
  };
}

/**
 * Combined auth + permission wrapper
 * Convenience function that combines authentication and permission checking
 *
 * Usage:
 * export const GET = withAuthAndPermission(
 *   ['vehicle:create'],
 *   async (request, { user }) => {
 *     // user is authenticated and has vehicle:create permission
 *     return NextResponse.json({ message: 'Vehicle created' });
 *   }
 * );
 */
export function withAuthAndPermission(
  permissions: string | string[],
  handler: (request: NextRequest, context: { user: JWTPayload }) => Promise<NextResponse>,
  options?: Omit<PermissionOptions, 'permissions'>
) {
  // Import withAuth dynamically to avoid circular dependency
  const { withAuth } = require('./auth');

  return withAuth(
    withPermission(
      {
        permissions,
        ...options,
      },
      handler
    )
  );
}

/**
 * Combined auth + role wrapper
 * Convenience function that combines authentication and role checking
 *
 * Usage:
 * export const GET = withAuthAndRole(
 *   ['admin', 'manager'],
 *   async (request, { user }) => {
 *     // user is authenticated and has admin or manager role
 *     return NextResponse.json({ message: 'Access granted' });
 *   }
 * );
 */
export function withAuthAndRole(
  roles: string | string[],
  handler: (request: NextRequest, context: { user: JWTPayload }) => Promise<NextResponse>
) {
  // Import withAuth dynamically to avoid circular dependency
  const { withAuth } = require('./auth');

  return withAuth(
    withRole(
      {
        roles,
      },
      handler
    )
  );
}

/**
 * Tenant isolation check
 * Ensures user can only access data from their own tenant
 * Super admins and platform admins bypass this check
 */
export async function requireTenantAccess(
  user: JWTPayload,
  requestedTenantId: string
): Promise<NextResponse | null> {
  const hasAccess = await rbacService.checkTenantAccess(user.userId, requestedTenantId);

  if (!hasAccess) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tenant access denied',
        message: 'You do not have access to this tenant',
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Helper to extract tenant ID from request
 * Checks URL params, query params, and body
 */
export async function extractTenantId(request: NextRequest): Promise<string | null> {
  // Try URL path params
  const urlParts = request.nextUrl.pathname.split('/');
  const tenantIndex = urlParts.indexOf('tenants');
  if (tenantIndex >= 0 && urlParts.length > tenantIndex + 1) {
    return urlParts[tenantIndex + 1];
  }

  // Try query params
  const queryTenantId = request.nextUrl.searchParams.get('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  // Try body (if POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const body = await request.json();
      if (body.tenantId) {
        return body.tenantId;
      }
    } catch {
      // Body not JSON or empty
    }
  }

  return null;
}
