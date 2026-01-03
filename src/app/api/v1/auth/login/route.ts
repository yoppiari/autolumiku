import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateTokenPair } from '@/lib/auth/jwt';
import { getUserPermissions, getRoleLevelFromRole } from '@/lib/auth/middleware';

// Self-healing: ensure roleLevel column exists
async function ensureRoleLevelColumn(): Promise<void> {
  try {
    await prisma.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'roleLevel'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "roleLevel" INTEGER NOT NULL DEFAULT 30;
        END IF;
      END $$;
    `;
    // Update roleLevel for existing users based on role
    await prisma.$executeRaw`
      UPDATE "users" SET "roleLevel" = CASE
        WHEN UPPER("role") = 'SUPER_ADMIN' THEN 110
        WHEN UPPER("role") = 'OWNER' THEN 100
        WHEN UPPER("role") = 'ADMIN' THEN 90
        WHEN UPPER("role") = 'MANAGER' THEN 70
        WHEN UPPER("role") = 'FINANCE' THEN 60
        ELSE 30
      END
      WHERE "roleLevel" = 30 OR "roleLevel" IS NULL;
    `;
    console.log('[Login] roleLevel column verified/created');
  } catch (err) {
    console.error('[Login] Failed to ensure roleLevel column:', err);
  }
}

export async function POST(request: NextRequest) {
  console.log('[Login] Starting login request - HIT');

  // Self-healing: ensure roleLevel column exists before any Prisma operations
  await ensureRoleLevelColumn();

  let body: any;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[Login] Failed to parse request body:', parseError);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { email, password } = body;
  console.log(`[Login] Attempting login for email: ${email}`);

  try {

    // Validate input
    if (!email || !password) {
      console.log('[Login] Missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find users by email (now multiple possible)
    console.log('[Login] Querying database for users matching email...');
    const users = await prisma.user.findMany({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        roleLevel: true,
        tenantId: true,
        emailVerified: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        tenant: {
          select: {
            id: true,
            domain: true,
            slug: true,
            name: true,
          }
        }
      }
    });

    if (users.length === 0) {
      console.log('[Login] No user found with this email');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // DISAMBIGUATION LOGIC:
    // If multiple users, find the best fit based on request origin (Host)
    let user = users[0];
    if (users.length > 1) {
      const host = request.headers.get('host') || '';
      console.log(`[Login] Multiple accounts found for ${email}. Identifying best fit for host: ${host}`);

      // 1. Try to find user matching this host domain
      const hostMatch = users.find(u => u.tenant?.domain === host);

      // 2. Try to find user matching platform (auto.lumiku.com or tenantId is null)
      const platformMatch = users.find(u => u.tenantId === null);

      if (hostMatch) {
        user = hostMatch;
        console.log(`[Login] Match found by host domain: ${user.tenant?.name}`);
      } else if (platformMatch && (host.includes('auto.lumiku.com') || host === 'localhost:3000')) {
        user = platformMatch;
        console.log(`[Login] Match found as platform admin`);
      } else {
        // Default to first user, but log a warning if it's ambiguous
        console.warn(`[Login] Ambiguous login for ${email}. Defaulting to first matching account.`);
      }
    }

    console.log(`[Login] Authenticating as User ID: ${user.id}, Tenant: ${user.tenantId || 'Platform'}, Role: ${user.role}`);

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.log('[Login] Account locked');
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Account locked. Try again in ${remainingMinutes} minutes.` },
        { status: 401 }
      );
    }

    // Verify password using bcrypt
    console.log('[Login] Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log(`[Login] Password valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= 5;
      console.log(`[Login] Invalid password. Failed attempts: ${newFailedAttempts}`);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 minutes
            : null,
        },
      });

      return NextResponse.json(
        {
          error: shouldLock
            ? 'Too many failed attempts. Account locked for 15 minutes.'
            : 'Invalid credentials',
        },
        { status: 401 }
      );
    }

    // Reset failed login attempts and update last login
    console.log('[Login] Updating user login stats...');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token pair
    console.log('[Login] Generating tokens...');
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    console.log('[Login] Tokens generated successfully');

    // Compute roleLevel from role if not set in database
    const roleLevel = user.roleLevel ?? getRoleLevelFromRole(user.role);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          roleLevel: roleLevel,
          tenantId: user.tenantId,
          emailVerified: user.emailVerified,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        permissions: getUserPermissions(user.role),
      },
    });
  } catch (error: any) {
    console.error('[Login] Critical Error:', error);
    console.error('[Login] Error Stack:', error.stack);
    console.error('[Login] Error Name:', error.name);
    console.error('[Login] Error Code:', error.code);
    console.error('[Login] Error Message:', error.message);

    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error.code === 'P2002') {
      errorMessage = 'Database constraint error';
    } else if (error.code === 'P2025') {
      errorMessage = 'Record not found';
    } else if (error.name === 'PrismaClientInitializationError') {
      errorMessage = 'Database connection failed';
      console.error('[Login] DATABASE_URL might be misconfigured');
    } else if (error.name === 'PrismaClientKnownRequestError') {
      // Show actual Prisma error for debugging
      errorMessage = `DB Error: ${error.code} - ${error.meta?.cause || error.message}`;
    } else if (error.name === 'PrismaClientValidationError') {
      errorMessage = `Validation Error: ${error.message?.substring(0, 100)}`;
    } else if (error.message?.includes('bcrypt')) {
      errorMessage = 'Password verification failed';
    } else if (error.message?.includes('jwt') || error.message?.includes('token')) {
      errorMessage = 'Token generation failed';
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        // Always show details temporarily for debugging
        debug: {
          name: error.name,
          code: error.code,
          message: error.message?.substring(0, 200),
          meta: error.meta,
        },
      },
      { status: statusCode }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}