import { NextRequest, NextResponse } from 'next/server';

// Mock showroom users database - using actual UUIDs from database
// NOTE: In production, query from database instead of mock data
const mockUsers = [
  {
    id: 'f8e7d6c5-b4a3-4c5d-8e9f-1a2b3c4d5e6f', // Use real user UUID
    email: 'user@showroom.com',
    password: 'user123', // In production, this would be hashed
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // ✅ Actual tenant UUID (Showroom Jakarta Premium)
    isActive: true,
    createdAt: new Date('2025-11-15T00:00:00Z'),
    lastLogin: null
  },
  {
    id: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d', // Use real user UUID
    email: 'staff@showroom.com',
    password: 'staff123', // In production, this would be hashed
    firstName: 'Staff',
    lastName: 'Member',
    role: 'staff',
    tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // ✅ Actual tenant UUID (Showroom Jakarta Premium)
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