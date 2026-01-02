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
        include: { tenant: true }
      });

      if (existingUser) {
        // SCENARIO 1: User exists in the SAME user-selected tenant -> UPDATE (Upsert)
        // Treat checking for "Showroom Jakarta" specifically if needed, but tenantId match is safer
        if (existingUser.tenantId === tenantId) {
          console.log(`♻️ User ${email} exists in same tenant. Updating...`);
          const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              firstName,
              lastName: lastName || '',
              role,
              emailVerified: emailVerified !== undefined ? emailVerified : existingUser.emailVerified,
              // Update password only if provided and different? 
              // For admin create, we usually overwrite password if provided.
              passwordHash: await bcrypt.hash(password, 10),
            },
            include: {
              tenant: {
                select: { id: true, name: true, slug: true }
              }
            }
          });

          return NextResponse.json({
            success: true,
            message: 'User berhasil diperbarui (Upsert)',
            data: updatedUser,
          });
        }

        // SCENARIO 2: User exists in a DUMMY tenant -> DELETE & RECREATE
        const dummyTenants = [
          "Tenant 1 Demo",
          "Showroom Jakarta Premium",
          "Showroom Jakarta",
          "Dealer Mobil",
          "AutoMobil",
          "AutoLumiku Platform"
        ];
        const isDummyUser = existingUser.tenant && dummyTenants.includes(existingUser.tenant.name);


        if (isDummyUser) {
          console.log(`♻️ Auto-cleaning dummy user ${email} from ${existingUser.tenant?.name}`);
          await prisma.user.delete({ where: { id: existingUser.id } });
          // Fall through to create new user below
        } else {
          // SCENARIO 2.5: Creating a Platform Admin (tenantId: null) using email from existing tenant admin
          // -> PROMOTE them to Super Admin by setting tenantId = null
          if (!tenantId) {
            console.log(`🔼 Promoting ${email} from ${existingUser.tenant?.name} to Platform Admin`);
            const promotedUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                firstName,
                lastName: last Name || '',
              role, // Should be 'super_admin' or 'admin'
              emailVerified: emailVerified !== undefined ? emailVerified : existingUser.emailVerified,
              passwordHash: await bcrypt.hash(password, 10),
              tenantId: null, // Promote to Platform Admin
            },
              include: {
              tenant: {
                select: { id: true, name: true, slug: true }
              }
            }
            });

  return NextResponse.json({
    success: true,
    message: `User berhasil dipromosikan ke Platform Admin dari ${existingUser.tenant?.name}`,
    data: promotedUser,
  });
}

// SCENARIO 3: User exists in a DIFFERENT, REAL tenant -> CONFLICT
return NextResponse.json(
  {
    success: false,
    error: `Email sudah terdaftar di tenant lain: ${existingUser.tenant?.name}`,
  },
  { status: 409 }
);
        }
      }

// Check if tenant exists (skip if tenantId is null for Platform Admins)
if (tenantId) {
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

  // Create new user (if not upserted)
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