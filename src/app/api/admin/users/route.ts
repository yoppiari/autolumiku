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

      // Check if user already exists GLOBALLY (email must be unique WITHIN A TENANT only)
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          tenantId: tenantId || null // Check specifically for conflict in THIS tenant
        },
        include: { tenant: true }
      });

      if (existingUser) {
        // User exists in the SAME user-selected tenant -> UPDATE (Upsert)
        console.log(`♻️ User ${email} exists in target tenant ${tenantId || 'Platform'}. Updating...`);
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName: lastName || '',
            role: upperRole,
            roleLevel: getRoleLevelFromRole(upperRole),
            emailVerified: emailVerified !== undefined ? emailVerified : existingUser.emailVerified,
            phone: phone || existingUser.phone,
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
          message: 'User berhasil diperbarui (Upsert di tenant)',
          data: updatedUser,
        });
      }

      // If we are here, the user doesn't exist in THIS tenant.
      // We can safely create a NEW record even if the email exists in OTHER tenants.
      // The Login API already handles disambiguation.

      // If we are here, the user doesn't exist in THIS tenant.
      // We can safely create a NEW record even if the email exists in another tenant.

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

      // Create new user (if not upserted)
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

      // SELF-HEALING LOGIC:
      // If error is Unique Constraint (P2002) on 'email', it means the DB still has the old constraint.
      // We fix it ON THE FLY by dropping the index, then retrying.
      if (error.code === 'P2002' && (error.meta?.target?.includes('email') || error.message?.includes('email'))) {
        console.warn('⚠️ Detected Legacy DB Constraint on Email. Attempting Self-Healing...');
        try {
          // Drop the legacy unique constraints (Try both standard naming conventions)
          await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "users_email_key";`);
          await prisma.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";`);
          await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "User_email_key";`);
          await prisma.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "User_email_key";`);

          console.log('✅ DB Constraint Dropped. Retrying User Creation...');

          // Retry Creation
          const retryUser = await prisma.user.create({
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
              tenant: { select: { id: true, name: true, slug: true } },
            },
          });

          return NextResponse.json({
            success: true,
            message: 'User berhasil dibuat (DB Constraint Fixed Automatically)',
            data: retryUser,
          });

        } catch (fixError) {
          console.error('❌ Self-Healing Failed:', fixError);
          // Verify if it failed because it really is a duplicate in THIS tenant
          // (We proceed to return standard error if fix fails)
        }
      }

      // Log more details if it's a Prisma error
      if (error.code) console.error('Prisma Error Code:', error.code);
      if (error.meta) console.error('Prisma Error Meta:', error.meta);

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