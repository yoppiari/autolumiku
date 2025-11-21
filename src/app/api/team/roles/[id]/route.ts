/**
 * Individual Role Management API
 * Provides endpoints for managing specific roles
 * Supports role updates, cloning, and deletion
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { RoleManagementService } from '@/services/rbac-service/roles/manager';
import { authenticateRequest } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const logger = new Logger('IndividualRoleAPI');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get specific role details with permissions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    const { id: roleId } = await params;

    const db = new DatabaseClient();
    const roleService = new RoleManagementService(db, auth.tenantId);

    // Check if user has permission to view roles
    await auth.requirePermission('team.view_roles');

    // Get role details
    const roleQuery = `
      SELECT
        dr.*,
        tenant_id IS NULL as is_system,
        COUNT(tmr.id) as member_count
      FROM dealership_roles dr
      LEFT JOIN team_member_roles tmr ON dr.id = tmr.role_id
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      WHERE dr.id = $1 AND (dr.tenant_id = $2 OR dr.tenant_id IS NULL)
      GROUP BY dr.id
    `;

    const roleResult = await db.query(roleQuery, [roleId, auth.tenantId]);
    if (roleResult.rows.length === 0) {
      await db.close();
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: 'Role not found'
        },
        { status: 404 }
      );
    }

    const role = roleResult.rows[0];

    // Get role permissions
    const permissionsQuery = `
      SELECT
        p.*,
        TRUE as granted
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.category, p.name
    `;

    const permissionsResult = await db.query(permissionsQuery, [roleId]);

    // Get role members
    const membersQuery = `
      SELECT
        tm.id,
        tm.user_id,
        u.first_name,
        u.last_name,
        u.email,
        tmr.is_primary,
        tmr.assigned_at,
        tm.is_active
      FROM team_member_roles tmr
      JOIN team_members tm ON tmr.team_member_id = tm.id
      JOIN users u ON tm.user_id = u.id
      WHERE tmr.role_id = $1 AND tm.tenant_id = $2
        AND tmr.effective_from <= CURRENT_TIMESTAMP
        AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      ORDER BY tmr.is_primary DESC, u.first_name, u.last_name
    `;

    const membersResult = await db.query(membersQuery, [roleId, auth.tenantId]);

    await db.close();

    return NextResponse.json({
      success: true,
      data: {
        ...role,
        permissions: permissionsResult.rows,
        members: membersResult.rows
      }
    });

  } catch (error) {
    logger.error('Failed to fetch role details', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch role details'
      },
      { status: 500 }
    );
  }
}

// PUT - Update role permissions
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    const { id: roleId } = await params;
    const { permissions } = await request.json();

    // Check if user has permission to manage roles
    await auth.requirePermission('team.manage_roles');

    // Validate permissions
    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Permissions must be an array'
        },
        { status: 400 }
      );
    }

    const db = new DatabaseClient();
    const roleService = new RoleManagementService(db, auth.tenantId);

    await roleService.updateRolePermissions(roleId, auth.userId, permissions);

    await db.close();

    return NextResponse.json({
      success: true,
      message: 'Role permissions updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update role permissions', { error });

    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: error.message
        },
        { status: 404 }
      );
    }

    if (error.message.includes('system role')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: error.message
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to update role permissions'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete custom role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    const { id: roleId } = await params;

    // Check if user has permission to delete roles
    await auth.requirePermission('team.delete_roles');

    const db = new DatabaseClient();
    const roleService = new RoleManagementService(db, auth.tenantId);

    await roleService.deleteCustomRole(roleId, auth.userId);

    await db.close();

    return NextResponse.json({
      success: true,
      message: 'Custom role deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete custom role', { error });

    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: error.message
        },
        { status: 404 }
      );
    }

    if (error.message.includes('system role')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: error.message
        },
        { status: 403 }
      );
    }

    if (error.message.includes('assigned to')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict',
          message: error.message
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete custom role'
      },
      { status: 500 }
    );
  }
}