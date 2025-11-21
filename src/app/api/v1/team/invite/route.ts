/**
 * Team Invitation API
 * Epic 1: Story 1.4 - Team Member Invitation
 *
 * Endpoint:
 * - POST /api/v1/team/invite - Send team invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { teamService } from '@/services/team.service';

/**
 * POST /api/v1/team/invite
 * Send team invitation
 */
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenantId || !body.email || !body.roleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          message: 'tenantId, email, and roleId are required',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email',
          message: 'Please provide a valid email address',
        },
        { status: 400 }
      );
    }

    // Check if user has permission to invite (admin/owner only)
    if (user.tenantId !== body.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only invite members to your own tenant',
        },
        { status: 403 }
      );
    }

    // Invite team member
    const result = await teamService.inviteTeamMember({
      tenantId: body.tenantId,
      email: body.email,
      role: body.roleId,
      invitedBy: user.id,
      message: body.message,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invitation failed',
          message: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          teamMember: result.teamMember,
        },
        message: result.message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Team invitation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to send invitation',
      },
      { status: 500 }
    );
  }
});
