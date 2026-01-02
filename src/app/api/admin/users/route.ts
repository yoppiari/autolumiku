/**
 * Users API Endpoint
 * Admin interface for managing platform users
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

/**
 * GET /api/admin/users - List all users
 */
export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      // TODO: Add admin authentication check
      // const session = await getServerSession(authOptions);
      // if (!session || session.user.role !== 'super_admin') {
      //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      // }

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { tenantId: null }, // Include Platform Admins
            {
              tenant: {
                name: {
                  notIn: [
                    "Tenant 1 Demo",
                    "Showroom Jakarta Premium",
                    "AutoLumiku Platform"
                  ]
                }
              }
            }
          ]
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
  });
}

/**
 * POST /api/admin/users - Create new user
 */
export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
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
          passwordHash: await bcrypt.hash(password, 10),
          role,
          tenantId,
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
  });
}