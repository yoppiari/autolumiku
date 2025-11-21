import { NextRequest, NextResponse } from 'next/server';
import { teamManagementService } from '@/services/team-management-service';
import { requirePermission } from '@/lib/middleware/admin-auth';
import { z } from 'zod';

/**
 * GET /api/team/members/[id] - Get individual team member details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require team management permission
    const handler = requirePermission('team:read')(async (req: NextRequest, user: any) => {
      const teamMemberId = params.id;

      if (!teamMemberId) {
        return NextResponse.json(
          { error: 'Team member ID is required' },
          { status: 400 }
        );
      }

      // Get team member with full details
      const teamMember = await teamManagementService.getTeamMemberById(teamMemberId, {
        includeActivity: true,
        includeRoles: true,
        includePerformance: true
      });

      if (!teamMember) {
        return NextResponse.json(
          { error: 'Team member not found' },
          { status: 404 }
        );
      }

      // Verify tenant access
      if (teamMember.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: teamMember
      });
    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to fetch team member:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch team member',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/team/members/[id] - Update team member details and roles
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require team management permission
    const handler = requirePermission('team:write')(async (req: NextRequest, user: any) => {
      const teamMemberId = params.id;

      if (!teamMemberId) {
        return NextResponse.json(
          { error: 'Team member ID is required' },
          { status: 400 }
        );
      }

      // Check if team member exists and belongs to tenant
      const existingMember = await teamManagementService.getTeamMemberById(teamMemberId);
      if (!existingMember) {
        return NextResponse.json(
          { error: 'Team member not found' },
          { status: 404 }
        );
      }

      if (existingMember.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const updateData = {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        department: body.department,
        position: body.position,
        status: body.status,
        roles: body.roles
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      // Validate update data
      if (updateData.firstName && typeof updateData.firstName !== 'string') {
        return NextResponse.json(
          { error: 'First name must be a string' },
          { status: 400 }
        );
      }

      if (updateData.lastName && typeof updateData.lastName !== 'string') {
        return NextResponse.json(
          { error: 'Last name must be a string' },
          { status: 400 }
        );
      }

      if (updateData.status && !['active', 'inactive', 'on_leave'].includes(updateData.status)) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        );
      }

      if (updateData.roles && !Array.isArray(updateData.roles)) {
        return NextResponse.json(
          { error: 'Roles must be an array' },
          { status: 400 }
        );
      }

      // Update team member
      const updatedMember = await teamManagementService.updateTeamMember(teamMemberId, updateData, {
        updatedBy: user.id
      });

      return NextResponse.json({
        success: true,
        data: updatedMember,
        message: 'Team member updated successfully'
      });

    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to update team member:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid role')) {
        return NextResponse.json(
          { error: 'One or more specified roles are invalid' },
          { status: 400 }
        );
      }

      if (error.message.includes('Cannot change role')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update team member',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members/[id] - Deactivate team member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require team management permission
    const handler = requirePermission('team:delete')(async (req: NextRequest, user: any) => {
      const teamMemberId = params.id;

      if (!teamMemberId) {
        return NextResponse.json(
          { error: 'Team member ID is required' },
          { status: 400 }
        );
      }

      // Check if team member exists and belongs to tenant
      const existingMember = await teamManagementService.getTeamMemberById(teamMemberId);
      if (!existingMember) {
        return NextResponse.json(
          { error: 'Team member not found' },
          { status: 404 }
        );
      }

      if (existingMember.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Prevent self-deactivation
      if (existingMember.userId === user.id) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own account' },
          { status: 400 }
        );
      }

      // Deactivate team member
      await teamManagementService.deactivateTeamMember(teamMemberId, {
        deactivatedBy: user.id,
        reason: 'Deactivated by administrator'
      });

      return NextResponse.json({
        success: true,
        message: 'Team member deactivated successfully'
      });

    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to deactivate team member:', error);
    return NextResponse.json(
      {
        error: 'Failed to deactivate team member',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}