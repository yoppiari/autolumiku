import { NextRequest, NextResponse } from 'next/server';

// Super admin users only - for platform management
const mockSuperAdmins = [
  {
    id: 'admin-1',
    email: 'admin@autolumiku.com',
    password: 'admin123', // In production, this would be hashed
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    tenantId: null,
    isActive: true,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    lastLogin: null
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Super admin login request body:', body); // Debug log
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find super admin by email
    const admin = mockSuperAdmins.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }

    // Check password (in production, use bcrypt.compare)
    if (admin.password !== password) {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }

    // Check if admin is active
    if (!admin.isActive) {
      return NextResponse.json(
        { error: 'Admin account is deactivated' },
        { status: 401 }
      );
    }

    // Remove password from response
    const { password: _, ...adminWithoutPassword } = admin;

    // Create mock JWT token (in production, use proper JWT)
    const token = Buffer.from(JSON.stringify({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId
    })).toString('base64');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Super admin login successful',
      data: {
        user: adminWithoutPassword,
        token: token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('Super admin login error:', error);
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