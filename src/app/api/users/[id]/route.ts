import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user-service';
import { withAdminAuth } from '@/lib/middleware/admin-auth';

interface Params {
  id: string;
}

/**
 * GET /api/users/[id] - Get specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user by ID
    const user = await userService.getUser(id);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id] - Update user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const updateData = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      role: body.role,
      tenantId: body.tenantId,
      status: body.status
    };

    // Update user
    const updatedUser = await userService.updateUser(id, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id] - Delete user (soft delete by setting status to inactive)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Soft delete user by setting status to inactive
    const updatedUser = await userService.updateUser(id, { status: 'inactive' });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/[id]/reset-password - Reset user password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Reset password
    const newPassword = await userService.resetPassword(id);

    return NextResponse.json({
      success: true,
      data: {
        temporaryPassword: newPassword
      },
      message: 'Password reset successfully. User should change password on next login.'
    });

  } catch (error) {
    console.error('Failed to reset password:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset password',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}