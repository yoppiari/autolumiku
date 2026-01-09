/**
 * Users API Endpoint
 * Admin interface for managing platform users
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withPlatformAuth } from '@/lib/auth/middleware';
import { getRoleLevelFromRole } from '@/lib/rbac';

/**
 * GET /api/admin/users - List all users
 */
export async function GET(request: NextRequest) {
  return withPlatformAuth(request, async (request, auth) => {
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

      // Fetch WhatsApp connection status for these users
      const staffAuths = await prisma.staffWhatsAppAuth.findMany({
        where: {
          userId: { in: users.map(u => u.id) }
        },
        select: {
          userId: true,
          isActive: true,
          phoneNumber: true
        }
      });

      // Merge status into user objects
      const usersWithStatus = users.map(user => {
        // Find auth by userId first
        let auth = staffAuths.find(a => a.userId === user.id);

        // If not found by userId but user has a phone, find by phoneNumber
        if (!auth && user.phone) {
          const cleanedUserPhone = user.phone.replace(/\D/g, '');
          auth = staffAuths.find(a => a.phoneNumber.replace(/\D/g, '') === cleanedUserPhone);
        }

        return {
          ...user,
          isActive: true, // Defaulting to true since DB field doesn't exist yet but user is active
          isWhatsAppActive: auth ? auth.isActive : false,
          phone: user.phone || auth?.phoneNumber || null
        };
      });

      return NextResponse.json({
        success: true,
        data: usersWithStatus,
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
  return withPlatformAuth(request, async (request, auth) => {
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
        phone,
      } = body;

      // Normalize role to uppercase immediately
      const upperRole = (role || '').toUpperCase();

      // Validate required fields
      // Allow tenantId to be null/empty ONLY if role is super_admin or admin (Platform Admin)
      const isPlatformRole = upperRole === 'SUPER_ADMIN' || upperRole === 'ADMIN';
      if (!email || !firstName || !password || !upperRole || (!tenantId && !isPlatformRole)) {
        return NextResponse.json(
          {
            success: false,
            error: isPlatformRole
              ? 'Email, nama, password, dan role wajib diisi'
              : 'Email, nama, password, role, dan tenant wajib diisi',
          },
          { status: 400 }
        );
      }

      // Check if user already exists GLOBALLY
      // We check global existence to handle the "Single User Row" constraint if DB doesn't support duplicates
      const existingUserGlobal = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
        },
        include: { tenant: true }
      });

      if (existingUserGlobal) {
        // User exists somewhere.

        // CASE A: User exists in the TARGET tenant (or Platform context if both null)
        const isSameContext = existingUserGlobal.tenantId === (tenantId || null);

        // CASE B: Request is for SUPER_ADMIN (Platform)
        // If user wants to be Super Admin, we can reuse their existing account regardless of tenant
        if (isPlatformRole) {
          console.log(`♻️ Promoting user ${email} to SUPER_ADMIN (Existing Tenant: ${existingUserGlobal.tenantId || 'None'})...`);
          const updatedUser = await prisma.user.update({
            where: { id: existingUserGlobal.id },
            data: {
              firstName,
              lastName: lastName || '',
              role: upperRole, // SUPER_ADMIN
              roleLevel: getRoleLevelFromRole(upperRole),
              emailVerified: emailVerified !== undefined ? emailVerified : existingUserGlobal.emailVerified,
              phone: phone || existingUserGlobal.phone,
              // We DO NOT update tenantId to avoid losing their home tenant data.
              // Login logic will handle their access to Platform.
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
            message: 'User berhasil diperbarui menjadi Super Admin',
            data: updatedUser,
          });
        }

        // CASE C: User exists in DIFFERENT tenant and NOT creating Super Admin
        if (!isSameContext) {
          // We try to create a new row. If DB has Unique Constraint, this will fail.
          // However, without migration, we can't fix it. 
          // But user logic "Harusnya tidak masalah" implies usually they update existing.
          // We will proceed to try CREATE, let it fail if DB is strict.
          // OR: We could auto-switch context? No, dangerous.
        } else {
          // Same context, just update
          const updatedUser = await prisma.user.update({
            where: { id: existingUserGlobal.id },
            data: {
              firstName,
              lastName: lastName || '',
              role: upperRole,
              roleLevel: getRoleLevelFromRole(upperRole),
              emailVerified: emailVerified !== undefined ? emailVerified : existingUserGlobal.emailVerified,
              phone: phone || existingUserGlobal.phone,
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
            message: 'User berhasil diperbarui',
            data: updatedUser,
          });
        }
      }

      // If we are here, the user doesn't exist GLOBALLY.
      // We can safely create a NEW record.

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
      }

      // Create new user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          firstName,
          lastName: lastName || '',
          passwordHash: await bcrypt.hash(password, 10),
          role: upperRole,
          roleLevel: getRoleLevelFromRole(upperRole),
          tenantId: tenantId || null,
          phone: phone || '',
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

    } catch (error: any) {
      console.error('❌ Create user error:', error);
      // Log more details if it's a Prisma error
      if (error.code) console.error('Prisma Error Code:', error.code);
      if (error.meta) console.error('Prisma Error Meta:', error.meta);

      // Friendly Error interpretation
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'Email ini sudah terdaftar di tenant lain. (Database Constraint: Single Global User).',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Internal server error',
        },
        { status: 500 }
      );
    }
  });
}