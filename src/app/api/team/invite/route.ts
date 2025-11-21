import { NextRequest, NextResponse } from 'next/server';
import { invitationService } from '@/services/invitation-service';
import { teamManagementService } from '@/services/team-management-service';
import { requirePermission } from '@/lib/middleware/admin-auth';
import { z } from 'zod';

// Validation schema for sending invitations
const sendInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
  customMessage: z.string().optional(),
  expirationDays: z.number().int().min(1).max(30).default(7)
});

/**
 * GET /api/team/invite - List pending invitations with filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Require team management permission
    const handler = requirePermission('team:read')(async (req: NextRequest, user: any) => {
      const { searchParams } = new URL(req.url);

      // Extract query parameters
      const tenantId = searchParams.get('tenantId') || user.tenantId;
      const status = searchParams.get('status') as 'pending' | 'accepted' | 'rejected' | 'expired';
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const search = searchParams.get('search');

      // Validate pagination
      if (page < 1 || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: 'Invalid pagination parameters' },
          { status: 400 }
        );
      }

      // Build filter options
      const filterOptions = {
        tenantId,
        status,
        search,
        page,
        limit
      };

      // Get invitations
      const result = await invitationService.getInvitations(filterOptions);

      return NextResponse.json({
        success: true,
        data: result.invitations,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.page * result.limit < result.total,
          hasPrev: result.page > 1
        }
      });
    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invitations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/invite - Send team invitation
 */
export async function POST(request: NextRequest) {
  try {
    // Require team management permission
    const handler = requirePermission('team:write')(async (req: NextRequest, user: any) => {
      // Parse and validate request body
      const body = await req.json();

      try {
        const validatedData = sendInvitationSchema.parse(body);

        // Check if user already exists as team member
        const existingMember = await teamManagementService.getTeamMemberByEmail(
          validatedData.email,
          user.tenantId
        );

        if (existingMember) {
          return NextResponse.json(
            { error: 'A team member with this email already exists' },
            { status: 409 }
          );
        }

        // Check if there's already a pending invitation
        const existingInvitation = await invitationService.getPendingInvitation(
          validatedData.email,
          user.tenantId
        );

        if (existingInvitation) {
          return NextResponse.json(
            {
              error: 'A pending invitation already exists for this email',
              invitationId: existingInvitation.id
            },
            { status: 409 }
          );
        }

        // Create invitation
        const invitation = await invitationService.createInvitation({
          tenantId: user.tenantId,
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          department: validatedData.department,
          position: validatedData.position,
          roles: validatedData.roles,
          customMessage: validatedData.customMessage,
          expirationDays: validatedData.expirationDays,
          invitedBy: user.id
        });

        return NextResponse.json({
          success: true,
          data: invitation,
          message: 'Invitation sent successfully'
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
    });

    return await handler(request);

  } catch (error) {
    console.error('Failed to send invitation:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid role')) {
        return NextResponse.json(
          { error: 'One or more specified roles are invalid' },
          { status: 400 }
        );
      }

      if (error.message.includes('Failed to send email')) {
        return NextResponse.json(
          { error: 'Failed to send invitation email. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to send invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}