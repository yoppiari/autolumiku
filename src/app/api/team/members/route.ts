import { NextRequest, NextResponse } from 'next/server';
import { teamManagementService } from '@/services/team-management-service';
import {
  withTeamAuth,
  requireTeamPermission,
  withTeamRateLimit,
  withRequestLogging,
  withSanitization
} from '@/lib/middleware/team-auth';
import { withValidation } from '@/lib/middleware/team-validation';
import { z } from 'zod';

// Validation schema for creating team members
const createTeamMemberSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
  hireDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  sendInvitation: z.boolean().default(true)
});

// Validation schema for updating team members
const updateTeamMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
  roles: z.array(z.string()).optional()
});

// Validation schema for query parameters
const getTeamMembersQuerySchema = z.object({
  tenantId: z.string().optional(),
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(100, Math.max(1, parseInt(val) || 20))),
  search: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
  role: z.string().optional(),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * GET /api/team/members - List team members with filtering and pagination
 */
export const GET = withRequestLogging(
  withTeamRateLimit({ limit: 200, windowMs: 60 * 1000 })(
    requireTeamPermission('team:read')(async (req: NextRequest, user: any) => {
      const { searchParams } = new URL(req.url);

      // Parse and validate query parameters
      const queryData = {
        tenantId: searchParams.get('tenantId'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        department: searchParams.get('department'),
        status: searchParams.get('status'),
        role: searchParams.get('role'),
        sortBy: searchParams.get('sortBy'),
        sortOrder: searchParams.get('sortOrder')
      };

      const validatedQuery = getTeamMembersQuerySchema.parse(queryData);

      // Build filter options
      const filterOptions = {
        tenantId: validatedQuery.tenantId || user.tenantId,
        search: validatedQuery.search,
        department: validatedQuery.department,
        status: validatedQuery.status,
        role: validatedQuery.role,
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        sortBy: validatedQuery.sortBy || 'createdAt',
        sortOrder: validatedQuery.sortOrder || 'desc'
      };

      // Get team members
      const result = await teamManagementService.getTeamMembers(filterOptions);

      return NextResponse.json({
        success: true,
        data: result.members,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.page * result.limit < result.total,
          hasPrev: result.page > 1
        }
      });
    })
  )
);

/**
 * POST /api/team/members - Create new team member invitation
 */
export const POST = withRequestLogging(
  withSanitization(
    withTeamRateLimit({ limit: 50, windowMs: 60 * 1000 })(
      withValidation(createTeamMemberSchema)(
        requireTeamPermission('team:write')(async (req: NextRequest, user: any, data: any) => {
          try {
            // Create team member with invitation
            const teamMember = await teamManagementService.createTeamMember({
              tenantId: user.tenantId,
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              phone: data.phone,
              department: data.department,
              position: data.position,
              roles: data.roles,
              hireDate: data.hireDate,
              sendInvitation: data.sendInvitation,
              invitedBy: user.id
            });

            return NextResponse.json({
              success: true,
              data: teamMember,
              message: data.sendInvitation
                ? 'Team member created and invitation sent'
                : 'Team member created successfully'
            }, { status: 201 });

          } catch (error) {
            // Handle specific errors
            if (error instanceof Error) {
              if (error.message.includes('already exists')) {
                return NextResponse.json(
                  { error: 'A team member with this email already exists' },
                  { status: 409 }
                );
              }

              if (error.message.includes('Invalid role')) {
                return NextResponse.json(
                  { error: 'One or more specified roles are invalid' },
                  { status: 400 }
                );
              }
            }

            throw error;
          }
        })
      )
    )
  )
);