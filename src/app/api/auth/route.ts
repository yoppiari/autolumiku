import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { AdminJWT } from '@/lib/middleware/admin-auth';

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Mock admin user database (in production, this would be a real database)
const mockAdminUsers = [
  {
    id: 'admin-1',
    email: 'admin@autolumiku.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    password: 'admin123' // In production, this would be hashed
  },
  {
    id: 'admin-2',
    email: 'operator@autolumiku.com',
    firstName: 'Operator',
    lastName: 'User',
    role: 'admin',
    password: 'operator123'
  }
];

/**
 * POST /api/auth/login - Admin login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin user
    const adminUser = mockAdminUsers.find(
      user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password (in production, use bcrypt.compare)
    if (adminUser.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role
      } as AdminJWT,
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create response with token
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role
        },
        token
      },
      message: 'Login successful'
    });

    // Set HTTP-only cookie for additional security
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/logout - Admin logout
 */
export async function DELETE(request: NextRequest) {
  try {
    // Create response that clears the auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

    // Clear the auth cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Immediately expire
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        error: 'Logout failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/me - Get current admin user
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('Authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJWT;

    // Find user in database
    const adminUser = mockAdminUsers.find(user => user.id === decoded.id);

    if (!adminUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    console.error('Auth verification error:', error);
    return NextResponse.json(
      {
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/refresh - Refresh JWT token
 */
export async function PUT(request: NextRequest) {
  try {
    // Get current token from cookie
    const cookieToken = request.cookies.get('auth-token')?.value;

    if (!cookieToken) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    // Verify current token (even if expired, we can extract the user info)
    const decoded = jwt.decode(cookieToken) as AdminJWT;

    if (!decoded || !decoded.id) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    // Find user and verify they still exist and are active
    const adminUser = mockAdminUsers.find(user => user.id === decoded.id);

    if (!adminUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create new JWT token
    const newToken = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role
      } as AdminJWT,
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create response with new token
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role
        },
        token: newToken
      },
      message: 'Token refreshed successfully'
    });

    // Update the auth cookie
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}