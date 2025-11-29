/**
 * Users API Endpoint
 * Admin interface for managing platform users
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/users - List all users
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'super_admin') {
    //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    // }

    const users = await prisma.user.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length,
    });

  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users - Create new user
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check

    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      password,
      role,
      tenantId,
      isActive,
      emailVerified,
    } = body;

    // Validate required fields
    if (!email || !firstName || !password || !role || !tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, nama, password, role, dan tenant wajib diisi',
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email sudah terdaftar',
        },
        { status: 409 }
      );
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant tidak ditemukan',
        },
        { status: 404 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName: lastName || '',
        passwordHash: password, // TODO: Hash password before storing (using bcrypt)
        role,
        tenantId,
        isActive: isActive !== undefined ? isActive : true,
        emailVerified: emailVerified !== undefined ? emailVerified : false,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User berhasil dibuat',
      data: user,
    });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}