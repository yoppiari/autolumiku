/**
 * Team Members API
 * Epic 1: Story 1.4 - Team Member Management
 *
 * Endpoint:
 * - GET /api/v1/team/:tenantId/members - Get all team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { teamService } from '@/services/team.service';

/**
 * GET /api/v1/team/:tenantId/members
 * Get all team members for a tenant
 */
export const GET = withAuth(
  async (request, { user, params }) => {
    try {
      const tenantId = params?.tenantId as string;

      if (!tenantId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing tenant ID',
            message: 'tenantId is required',
          },
          { status: 400 }
        );
      }

      // Check if user has access to this tenant
      if (user.tenantId !== tenantId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'You can only view members of your own tenant',
          },
          { status: 403 }
        );
      }

      // Get team members
      const result = await teamService.getTeamMembers(tenantId);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to retrieve team members',
            message: result.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          members: result.members,
        },
      });
    } catch (error) {
      console.error('Get team members API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: 'Failed to retrieve team members',
        },
        { status: 500 }
      );
    }
  }
);
