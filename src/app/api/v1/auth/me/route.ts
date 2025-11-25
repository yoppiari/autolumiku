import { NextRequest, NextResponse } from 'next/server';

// Mock user database - using actual UUIDs
// NOTE: In production, query from database instead of mock data
const mockUsers = [
  {
    id: '9e8d7c6b-5a4f-4e3d-2c1b-0a9b8c7d6e5f', // Real super admin UUID
    email: 'admin@autolumiku.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    tenantId: null, // ✅ Super admin has no tenant
    isActive: true,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    lastLogin: new Date('2025-11-23T10:30:00Z')
  },
  {
    id: 'f8e7d6c5-b4a3-4c5d-8e9f-1a2b3c4d5e6f', // Real user UUID
    email: 'user@showroom.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // ✅ Actual tenant UUID
    isActive: true,
    createdAt: new Date('2025-11-15T00:00:00Z'),
    lastLogin: new Date('2025-11-23T14:20:00Z')
  },
  {
    id: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d', // Real staff UUID
    email: 'staff@showroom.com',
    firstName: 'Staff',
    lastName: 'Member',
    role: 'staff',
    tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // ✅ Actual tenant UUID
    isActive: true,
    createdAt: new Date('2025-11-20T00:00:00Z'),
    lastLogin: null
  }
];

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Decode mock JWT token (in production, use proper JWT verification)
    let decodedToken;
    try {
      decodedToken = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Find user by ID from token
    const user = mockUsers.find(u => u.id === decodedToken.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 }
      );
    }

    // Return user data (excluding sensitive info)
    const { createdAt, ...userWithoutSensitiveData } = user;

    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutSensitiveData,
        permissions: getUserPermissions(user.role)
      }
    });

  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getUserPermissions(role: string): string[] {
  switch (role) {
    case 'super_admin':
      return [
        'tenant:create', 'tenant:read', 'tenant:update', 'tenant:delete',
        'user:create', 'user:read', 'user:update', 'user:delete',
        'analytics:read', 'audit:read', 'settings:update'
      ];
    case 'admin':
      return [
        'user:create', 'user:read', 'user:update',
        'inventory:read', 'inventory:update',
        'leads:read', 'leads:update',
        'analytics:read'
      ];
    case 'manager':
      return [
        'user:read', 'inventory:read', 'inventory:update',
        'leads:read', 'leads:update',
        'analytics:read'
      ];
    case 'staff':
      return [
        'inventory:read', 'leads:read', 'leads:update'
      ];
    default:
      return [];
  }
}