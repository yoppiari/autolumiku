import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user-service';
import { withAdminAuth } from '@/lib/middleware/admin-auth';
import { CreateUserRequest } from '@/services/user-service';

/**
 * GET /api/users - List users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    let users;

    // Get users based on filters
    if (tenantId) {
      users = await userService.getUsersByTenant(tenantId);
    } else {
      // In production, this would get all users with pagination
      users = []; // Placeholder
    }

    // Apply additional filters
    if (role) {
      users = users.filter(user => user.role === role);
    }

    if (status) {
      users = users.filter(user => user.status === status);
    }

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length
    });

  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users - Create new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await withAdminAuth(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const createUserData: CreateUserRequest = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      role: body.role,
      tenantId: body.tenantId,
      password: body.password,
      sendWelcomeEmail: body.sendWelcomeEmail !== false // Default to true
    };

    // Validate required fields
    if (!createUserData.email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!createUserData.firstName?.trim()) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    if (!createUserData.lastName?.trim()) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      );
    }

    if (!createUserData.role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      );
    }

    // Create user
    const user = await userService.createUser(createUserData);

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create user:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create user',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}