import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { RoleManagementService } from '@/services/rbac-service/roles/manager';
import { authenticateRequest } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const logger = new Logger('TeamRolesAPI');

/**
 * GET /api/team/roles - List available roles with permission matrix
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    const db = new DatabaseClient();
    const roleService = new RoleManagementService(db, auth.tenantId);

    // Check if user has permission to view roles
    await auth.requirePermission('team.view_roles');

    const { searchParams } = new URL(request.url);
    const includeUsage = searchParams.get('includeUsage') === 'true';
    const includeMatrix = searchParams.get('includeMatrix') === 'true';
    const includeCustom = searchParams.get('includeCustom') === 'true';
    const includeSystem = searchParams.get('includeSystem') !== 'false';

    let result;

    if (includeMatrix) {
      result = await roleService.getRoleMatrix();
    } else if (includeUsage) {
      result = await roleService.getRoleUsageStatistics();
    } else {
      // Get basic role list
      let whereClause = 'WHERE (tenant_id = $1 OR tenant_id IS NULL)';
      if (!includeCustom) whereClause += ' AND tenant_id IS NULL';
      if (!includeSystem) whereClause += ' AND tenant_id = $1';

      const query = `
        SELECT
          id, name, display_name, indonesian_title,
          description, department, role_level, is_active,
          tenant_id IS NULL as is_system
        FROM dealership_roles
        ${whereClause}
        ORDER BY role_level ASC, name ASC
      `;
      const dbResult = await db.query(query, [auth.tenantId]);
      result = dbResult.rows;
    }

    await db.close();

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        total: Array.isArray(result) ? result.length : 0,
        includeUsage,
        includeMatrix,
        includeCustom,
        includeSystem
      }
    });

  } catch (error) {
    logger.error('Failed to fetch roles', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch roles'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/roles - Create custom role (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    // Check if user has permission to create roles
    await auth.requirePermission('team.create_roles');

    const body = await request.json();
    const {
      name,
      displayName,
      indonesianTitle,
      description,
      department,
      roleLevel,
      permissions,
      inheritsFrom
    } = body;

    // Validate required fields
    if (!name || !displayName || !indonesianTitle || !department) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Missing required fields: name, displayName, indonesianTitle, department'
        },
        { status: 400 }
      );
    }

    // Validate role level
    if (typeof roleLevel !== 'number' || roleLevel < 1 || roleLevel > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: 'Role level must be a number between 1 and 100'
        },
        { status: 400 }
      );
    }

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

    const newRole = await roleService.createCustomRole(auth.userId, {
      name: name.trim(),
      displayName: displayName.trim(),
      indonesianTitle: indonesianTitle.trim(),
      description: description?.trim() || '',
      department: department.trim(),
      roleLevel,
      permissions,
      inheritsFrom
    });

    await db.close();

    return NextResponse.json({
      success: true,
      data: newRole,
      message: 'Custom role created successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Failed to create custom role', { error });

    if (error.message.includes('already exists')) {
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
        message: 'Failed to create custom role'
      },
      { status: 500 }
    );
  }
}