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

      // Fetch WhatsApp connection status & Active Bots for profile syncing
      let staffAuths: any[] = [];
      let activeBots: any[] = [];

      try {
        const [auths, bots] = await Promise.all([
          prisma.staffWhatsAppAuth.findMany({
            where: {
              userId: { in: users.map(u => u.id) }
            },
            select: {
              id: true, // Need ID for update
              userId: true,
              isActive: true,
              phoneNumber: true,
              profilePicUrl: true
            }
          }),
          prisma.aimeowAccount.findMany({
            where: {
              isActive: true,
              connectionStatus: 'connected'
            },
            select: {
              clientId: true,
              tenantId: true
            }
          })
        ]);

        staffAuths = auths;
        activeBots = bots;

      } catch (error: any) {
        console.warn('[Users API] Failed to fetch auths or bots:', error.message);
        // Fallback - try without profilePicUrl if field doesn't exist
        try {
          staffAuths = await prisma.staffWhatsAppAuth.findMany({
            where: { userId: { in: users.map(u => u.id) } },
            select: { id: true, userId: true, isActive: true, phoneNumber: true, profilePicUrl: true }
          });
        } catch (fallbackError: any) {
          console.warn('[Users API] Fallback 1 failed, trying without profilePicUrl:', fallbackError.message);
          // Final fallback without profilePicUrl
          try {
            const basicAuths = await prisma.staffWhatsAppAuth.findMany({
              where: { userId: { in: users.map(u => u.id) } },
              select: { id: true, userId: true, isActive: true, phoneNumber: true }
            });
            staffAuths = basicAuths.map(auth => ({ ...auth, profilePicUrl: null }));
          } catch (finalError) {
            console.error('[Users API] All fallbacks failed:', finalError);
            staffAuths = []; // Empty array as last resort
          }
        }
      }

      // Merge status AND Sync Profile Pictures if needed
      // Use a connected bot to fetch profile pics
      let AimeowClientService: any = null;
      const systemBot = activeBots.length > 0 ? activeBots[0] : null;

      // Try to load AimeowClientService, but don't fail if it's not available
      try {
        const aimeowModule = require('@/lib/services/aimeow/aimeow-client.service');
        AimeowClientService = aimeowModule.AimeowClientService;
      } catch (err) {
        console.warn('[Users API] AimeowClientService not available:', err);
      }

      const usersWithStatus = await Promise.all(users.map(async user => {
        try {
          // Find auth by userId first
          let auth = staffAuths.find(a => a.userId === user.id);

          // If not found by userId but user has a phone, find by phoneNumber
          if (!auth && user.phone) {
            const cleanedUserPhone = user.phone.replace(/\D/g, '');
            auth = staffAuths.find(a => a.phoneNumber.replace(/\D/g, '') === cleanedUserPhone);
          }

          let profilePicUrl = auth?.profilePicUrl;

          // REALTIME SYNC: If we have a connected bot and a phone number, try to fetch/refresh profile pic
          // Condition: No profile pic OR we want to ensure it's fresh (maybe every time?)
          // To avoid excessive API calls, we'll do it if profilePicUrl is missing OR randomly (10% chance) to keep updated
          const phoneNumber = user.phone || auth?.phoneNumber;
          const needsSync = phoneNumber && systemBot && AimeowClientService && (!profilePicUrl || Math.random() < 0.1);

          if (needsSync) {
            try {
              // Determine which bot to use (prefer tenant's own bot if available)
              const preferredBot = activeBots.find(b => b.tenantId === user.tenantId) || systemBot;

              // Call Aimeow to get profile pic with timeout
              const picResult = await Promise.race([
                AimeowClientService.getProfilePicture(preferredBot.clientId, phoneNumber),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
              ]);

              if (picResult.success && picResult.hasPicture && picResult.pictureUrl) {
                profilePicUrl = picResult.pictureUrl;

                // Update DB if we found a match in StaffWhatsAppAuth
                if (auth) {
                  await prisma.staffWhatsAppAuth.update({
                    where: { id: auth.id },
                    data: { profilePicUrl: picResult.pictureUrl }
                  }).catch(e => console.error('Failed to update profile pic DB:', e));
                }
              }
            } catch (err) {
              // Silently fail - don't log to avoid spam
            }
          }

          return {
            ...user,
            isActive: true,
            isWhatsAppActive: auth ? auth.isActive : false,
            phone: phoneNumber || null,
            profilePicUrl: profilePicUrl || null
          };
        } catch (userError) {
          // If individual user processing fails, return basic data
          console.error(`Failed to process user ${user.email}:`, userError);
          return {
            ...user,
            isActive: true,
            isWhatsAppActive: false,
            phone: user.phone || null,
            profilePicUrl: null
          };
        }
      }));

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
