import { NextRequest, NextResponse } from 'next/server';

// Mock user database
const mockUsers = [
  {
    id: 'admin-1',
    email: 'admin@autolumiku.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    tenantId: null,
    isActive: true,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    lastLogin: new Date('2025-11-23T10:30:00Z')
  },
  {
    id: 'user-1',
    email: 'user@showroom.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    tenantId: 'tenant-1',
    isActive: true,
    createdAt: new Date('2025-11-15T00:00:00Z'),
    lastLogin: new Date('2025-11-23T14:20:00Z')
  },
  {
    id: 'staff-1',
    email: 'staff@showroom.com',
    firstName: 'Staff',
    lastName: 'Member',
    role: 'staff',
    tenantId: 'tenant-1',
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