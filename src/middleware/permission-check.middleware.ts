/**
 * Permission Check Middleware
 * Implements comprehensive permission checking with security monitoring
 * Part of Story 1.8: Role-Based Access Control
 */

import { NextRequest, NextResponse } from 'next/server';
import { PermissionService } from '@/services/rbac-service/checks/evaluator';
import { SecurityMonitoringService } from '@/services/security-monitoring-service';
import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';

const logger = new Logger('PermissionMiddleware');

export interface PermissionCheckOptions {
  permissions: string | string[]; // Single permission or array of permissions
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user must have ANY permission
  resourceType?: string; // Type of resource being accessed
  getResourceId?: (req: NextRequest) => string | undefined; // Function to extract resource ID from request
}

/**
 * Middleware factory for permission-based route protection
 */
export function requirePermission(options: PermissionCheckOptions) {
  return async (req: NextRequest) => {
    const db = new DatabaseClient();

    try {
      // Extract user and tenant from request (assuming JWT authentication middleware has already run)
      const userId = req.headers.get('x-user-id');
      const tenantId = req.headers.get('x-tenant-id');

      if (!userId || !tenantId) {
        await logUnauthorizedAccess(db, req, tenantId, 'Missing authentication headers');
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }

      // Initialize permission service
      const permissionService = new PermissionService(db, tenantId);
      const securityMonitoring = new SecurityMonitoringService(db);

      // Normalize permissions to array
      const permissions = Array.isArray(options.permissions)
        ? options.permissions
        : [options.permissions];

      // Get resource ID if function provided
      const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;

      // Check permissions
      let hasAccess: boolean;
      if (options.requireAll) {
        hasAccess = await permissionService.hasAllPermissions(userId, permissions);
      } else {
        hasAccess = await permissionService.hasAnyPermission(userId, permissions);
      }

      // Log permission check to audit trail
      await logPermissionCheck(db, {
        tenantId,
        userId,
        permissions,
        resourceType: options.resourceType,
        resourceId,
        checkResult: hasAccess,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent')
      });

      // If access denied, log security event
      if (!hasAccess) {
        await securityMonitoring.logSecurityEvent({
          eventType: 'PERMISSION_DENIED',
          severity: 'MEDIUM',
          userId,
          tenantId,
          resourceType: options.resourceType,
          resourceId,
          deniedPermission: permissions.join(', '),
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          details: {
            path: req.nextUrl.pathname,
            method: req.method,
            requiredAll: options.requireAll
          }
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to perform this action',
              requiredPermissions: permissions
            }
          },
          { status: 403 }
        );
      }

      // Permission granted - continue with request
      return NextResponse.next();

    } catch (error) {
      logger.error('Permission check failed', { error, path: req.nextUrl.pathname });
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Permission check failed' } },
        { status: 500 }
      );
    } finally {
      await db.close();
    }
  };
}

/**
 * Middleware to check if user can manage another user (based on role hierarchy)
 */
export function requireCanManageUser() {
  return async (req: NextRequest) => {
    const db = new DatabaseClient();

    try {
      const userId = req.headers.get('x-user-id');
      const tenantId = req.headers.get('x-tenant-id');

      if (!userId || !tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }

      // Extract target user ID from request
      const targetUserId = extractTargetUserId(req);
      if (!targetUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Target user ID required' } },
          { status: 400 }
        );
      }

      const permissionService = new PermissionService(db, tenantId);
      const canManage = await permissionService.canManageUser(userId, targetUserId);

      if (!canManage) {
        const securityMonitoring = new SecurityMonitoringService(db);
        await securityMonitoring.logSecurityEvent({
          eventType: 'ROLE_ESCALATION_ATTEMPT',
          severity: 'HIGH',
          userId,
          tenantId,
          resourceType: 'user',
          resourceId: targetUserId,
          attemptedAction: 'manage_user',
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          details: {
            path: req.nextUrl.pathname,
            method: req.method
          }
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_PRIVILEGES',
              message: 'You do not have sufficient privileges to manage this user'
            }
          },
          { status: 403 }
        );
      }

      return NextResponse.next();

    } catch (error) {
      logger.error('Manage user check failed', { error });
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Authorization check failed' } },
        { status: 500 }
      );
    } finally {
      await db.close();
    }
  };
}

/**
 * Helper function to log permission checks to audit trail
 */
async function logPermissionCheck(
  db: DatabaseClient,
  data: {
    tenantId: string;
    userId: string;
    permissions: string[];
    resourceType?: string;
    resourceId?: string;
    checkResult: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  try {
    const query = `
      INSERT INTO permission_check_audit (
        tenant_id, user_id, permission_code,
        resource_type, resource_id, check_result,
        ip_address, user_agent, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;

    // Log each permission check separately for detailed audit trail
    for (const permission of data.permissions) {
      await db.query(query, [
        data.tenantId,
        data.userId,
        permission,
        data.resourceType || null,
        data.resourceId || null,
        data.checkResult,
        data.ipAddress || null,
        data.userAgent || null
      ]);
    }
  } catch (error) {
    logger.error('Failed to log permission check', { error, data });
    // Don't throw - logging failure shouldn't break the permission check
  }
}

/**
 * Helper function to log unauthorized access attempts
 */
async function logUnauthorizedAccess(
  db: DatabaseClient,
  req: NextRequest,
  tenantId: string | null,
  reason: string
): Promise<void> {
  try {
    const securityMonitoring = new SecurityMonitoringService(db);
    await securityMonitoring.logSecurityEvent({
      eventType: 'UNAUTHORIZED_ACCESS',
      severity: 'MEDIUM',
      tenantId: tenantId || 'unknown',
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      details: {
        path: req.nextUrl.pathname,
        method: req.method,
        reason
      }
    });
  } catch (error) {
    logger.error('Failed to log unauthorized access', { error });
  }
}

/**
 * Extract target user ID from request
 */
function extractTargetUserId(req: NextRequest): string | undefined {
  // Try to extract from URL params
  const urlParts = req.nextUrl.pathname.split('/');
  const userIndex = urlParts.indexOf('users');
  if (userIndex >= 0 && urlParts.length > userIndex + 1) {
    return urlParts[userIndex + 1];
  }

  // Try to extract from query params
  const targetUserId = req.nextUrl.searchParams.get('userId') ||
                       req.nextUrl.searchParams.get('targetUserId');

  return targetUserId || undefined;
}

/**
 * Decorator for permission-protected API route handlers
 * Usage in Next.js API routes:
 *
 * export const GET = withPermission(['inventory.view'], async (req) => {
 *   // Your route handler code
 * });
 */
export function withPermission(
  permissions: string | string[],
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: Omit<PermissionCheckOptions, 'permissions'>
) {
  return async (req: NextRequest) => {
    const permissionCheck = requirePermission({
      permissions,
      ...options
    });

    const checkResult = await permissionCheck(req);

    // If permission check returned a response (denied), return it
    if (checkResult.status !== 200) {
      return checkResult;
    }

    // Permission granted - call the actual handler
    return handler(req);
  };
}
