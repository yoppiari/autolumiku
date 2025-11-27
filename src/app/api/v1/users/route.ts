/**
 * User Management API
 * GET /api/v1/users - List users with filtering
 * POST /api/v1/users - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { tenantId };

    if (role && role !== 'all') {
      where.role = role.toUpperCase();
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get role stats
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where: { tenantId },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        users,
        stats: {
          total: users.length,
          byRole: roleStats.reduce((acc: any, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, email, firstName, lastName, role } = body;

    if (!tenantId || !email || !firstName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create user with a temporary password
    // In production, you should generate a secure random password or use invitation token
    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        firstName,
        lastName: lastName || '',
        role: role.toUpperCase(),
        passwordHash: 'temporary_hash', // In production: await bcrypt.hash(randomPassword, 10)
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
