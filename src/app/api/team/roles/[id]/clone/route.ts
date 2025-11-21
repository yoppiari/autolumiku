/**
 * Role Clone API
 * Provides endpoint for cloning existing roles with modifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { RoleManagementService } from '@/services/rbac-service/roles/manager';
import { authenticateRequest } from '@/lib/auth';
import { Logger } from '@/lib/logger';

const logger = new Logger('RoleCloneAPI');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Clone existing role
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized', message: auth.error },
        { status: 401 }
      );
    }

    const { id: sourceRoleId } = await params;
    const body = await request.json();
    const {
      name,
      displayName,
      indonesianTitle,
      description,
      department,
      roleLevel,
      permissions
    } = body;

    // Check if user has permission to create roles
    await auth.requirePermission('team.create_roles');

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

    const db = new DatabaseClient();
    const roleService = new RoleManagementService(db, auth.tenantId);

    const clonedRole = await roleService.cloneRole(sourceRoleId, auth.userId, {
      name: name.trim(),
      displayName: displayName.trim(),
      indonesianTitle: indonesianTitle.trim(),
      description: description?.trim() || '',
      department: department.trim(),
      roleLevel,
      permissions
    });

    await db.close();

    return NextResponse.json({
      success: true,
      data: clonedRole,
      message: 'Role cloned successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Failed to clone role', { error });

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
        message: 'Failed to clone role'
      },
      { status: 500 }
    );
  }
}