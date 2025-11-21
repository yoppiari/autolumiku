import { NextRequest, NextResponse } from 'next/server';
import { teamManagementService } from '@/services/team-management-service';
import { requirePermission } from '@/lib/middleware/admin-auth';
import { z } from 'zod';

// Validation schema for role updates
const updateRoleSchema = z.object({
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
  primaryRoleId: z.string().optional()
}).refine(data => {
  // If primaryRoleId is provided, it must be in the roleIds array
  if (data.primaryRoleId && !data.roleIds.includes(data.primaryRoleId)) {
    return false;
  }
  return true;
}, {
  message: "Primary role must be included in the role list",
  path: ["primaryRoleId"]
});

/**
 * PUT /api/team/members/[id]/role - Update member role
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

      // Prevent self-role modification
      if (existingMember.userId === user.id) {
        return NextResponse.json(
          { error: 'You cannot modify your own roles' },
          { status: 400 }
        );
      }

      // Parse and validate request body
      const body = await req.json();

      try {
        const validatedData = updateRoleSchema.parse(body);

        // Validate roles
        const validRoles = await teamManagementService.validateRoles(validatedData.roleIds);
        if (validRoles.length !== validatedData.roleIds.length) {
          const invalidRoles = validatedData.roleIds.filter(
            (roleId: string) => !validRoles.includes(roleId)
          );
          return NextResponse.json(
            {
              error: 'Invalid roles specified',
              invalidRoles
            },
            { status: 400 }
          );
        }

        // Update team member roles
        const updatedMember = await teamManagementService.updateTeamMemberRoles(
          teamMemberId,
          {
            roleIds: validatedData.roleIds,
            primaryRoleId: validatedData.primaryRoleId,
            updatedBy: user.id
          }
        );

        return NextResponse.json({
          success: true,
          data: updatedMember,
          message: 'Team member roles updated successfully'
        });

      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json({
            error: 'Validation failed',
            details: validationError.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          }, { status: 400 });
        }
        throw validationError;
      }
    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to update team member roles:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Cannot assign')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      if (error.message.includes('At least one admin')) {
        return NextResponse.json(
          { error: 'At least one team member must have admin privileges' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update team member roles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}