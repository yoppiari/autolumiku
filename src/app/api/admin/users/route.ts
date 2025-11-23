/**
 * Users API Endpoint
 * Admin interface for managing platform users
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock users data for development
const mockUsers = [
  {
    id: '1',
    email: 'admin@autolumiku.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    emailVerified: true,
    isActive: true,
    createdAt: '2025-11-01T00:00:00Z',
    lastLoginAt: '2025-11-23T10:30:00Z',
  },
  {
    id: '2',
    email: 'admin@showroomjakarta.com',
    firstName: 'Admin',
    lastName: 'Showroom',
    role: 'admin',
    tenantId: 'tenant-1',
    tenantName: 'Showroom Jakarta',
    emailVerified: true,
    isActive: true,
    createdAt: '2025-11-02T00:00:00Z',
    lastLoginAt: '2025-11-23T09:15:00Z',
  },
  {
    id: '3',
    email: 'manager@showroomjakarta.com',
    firstName: 'Budi',
    lastName: 'Santoso',
    role: 'manager',
    tenantId: 'tenant-1',
    tenantName: 'Showroom Jakarta',
    emailVerified: true,
    isActive: true,
    createdAt: '2025-11-03T00:00:00Z',
    lastLoginAt: '2025-11-23T08:45:00Z',
  },
  {
    id: '4',
    email: 'sales@showroomjakarta.com',
    firstName: 'Siti',
    lastName: 'Rahayu',
    role: 'staff',
    tenantId: 'tenant-1',
    tenantName: 'Showroom Jakarta',
    emailVerified: true,
    isActive: true,
    createdAt: '2025-11-05T00:00:00Z',
    lastLoginAt: '2025-11-22T16:20:00Z',
  },
  {
    id: '5',
    email: 'user@dealermobil.com',
    firstName: 'Ahmad',
    lastName: 'Pratama',
    role: 'staff',
    tenantId: 'tenant-2',
    tenantName: 'Dealer Mobil',
    emailVerified: true,
    isActive: false,
    createdAt: '2025-11-10T00:00:00Z',
    lastLoginAt: '2025-11-15T14:30:00Z',
  },
];

/**
 * GET /api/admin/users - List all users
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role') || 'all';
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    // Filter users
    let filteredUsers = mockUsers;

    if (role !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }

    if (status !== 'all') {
      const isActive = status === 'active';
      filteredUsers = filteredUsers.filter(user => user.isActive === isActive);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        (user.tenantName && user.tenantName.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredUsers,
      total: filteredUsers.length,
    });

  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users - Create new user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.email || !body.firstName || !body.lastName || !body.password) {
      return NextResponse.json(
        { error: 'Email, nama, dan password wajib diisi' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = mockUsers.find(user => user.email === body.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    // Create new user (mock)
    const newUser = {
      id: Date.now().toString(),
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      tenantId: body.tenantId,
      tenantName: body.tenantId ? mockUsers.find(u => u.id === body.tenantId)?.tenantName : undefined,
      emailVerified: body.emailVerified || true,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    // In production, save to database
    console.log('Creating user:', newUser);

    return NextResponse.json({
      success: true,
      message: 'User berhasil dibuat',
      data: newUser,
    });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}