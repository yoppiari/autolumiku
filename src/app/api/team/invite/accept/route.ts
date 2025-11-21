import { NextRequest, NextResponse } from 'next/server';
import { invitationService } from '@/services/invitation-service';
import { teamManagementService } from '@/services/team-management-service';
import { z } from 'zod';

// Validation schema for accepting invitations
const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

/**
 * POST /api/team/invite/accept - Accept invitation and create account
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    try {
      const validatedData = acceptInvitationSchema.parse(body);

      // Validate invitation token and get invitation details
      const invitation = await invitationService.getInvitationByToken(validatedData.token);

      if (!invitation) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation token' },
          { status: 400 }
        );
      }

      // Check invitation status
      if (invitation.status !== 'pending') {
        return NextResponse.json(
          {
            error: 'Invitation is no longer valid',
            status: invitation.status
          },
          { status: 400 }
        );
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Invitation has expired' },
          { status: 400 }
        );
      }

      // Accept invitation and create team member
      const result = await invitationService.acceptInvitation(validatedData.token, {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        password: validatedData.password
      });

      return NextResponse.json({
        success: true,
        data: {
          user: result.user,
          teamMember: result.teamMember
        },
        message: 'Invitation accepted successfully. Your account has been created.'
      }, { status: 201 });

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

  } catch (error) {
    console.error('Failed to accept invitation:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      if (error.message.includes('Invalid token')) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation token' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to accept invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team/invite/accept - Get invitation details by token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation details
    const invitation = await invitationService.getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      );
    }

    // Check invitation status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        {
          error: 'Invitation is no longer valid',
          status: invitation.status
        },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Return invitation details (excluding sensitive information)
    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        department: invitation.department,
        position: invitation.position,
        roles: invitation.roles,
        tenantName: invitation.tenant?.name,
        expiresAt: invitation.expiresAt
      }
    });

  } catch (error) {
    console.error('Failed to fetch invitation details:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invitation details',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}