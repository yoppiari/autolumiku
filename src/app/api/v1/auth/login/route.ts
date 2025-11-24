import { NextRequest, NextResponse } from 'next/server';

// Mock showroom users database - in production, this would be a real database
const mockUsers = [
  {
    id: 'user-1',
    email: 'user@showroom.com',
    password: 'user123', // In production, this would be hashed
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    tenantId: 'tenant-1',
    isActive: true,
    createdAt: new Date('2025-11-15T00:00:00Z'),
    lastLogin: null
  },
  {
    id: 'staff-1',
    email: 'staff@showroom.com',
    password: 'staff123', // In production, this would be hashed
    firstName: 'Staff',
    lastName: 'Member',
    role: 'staff',
    tenantId: 'tenant-1',
    isActive: true,
    createdAt: new Date('2025-11-20T00:00:00Z'),
    lastLogin: null
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Login request body:', body); // Debug log
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 }
      );
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Create mock JWT token (in production, use proper JWT)
    const token = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    })).toString('base64');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token: token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}