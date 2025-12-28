import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateTokenPair } from '@/lib/auth/jwt';
import { getUserPermissions } from '@/lib/auth/middleware';

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
    await prisma.$executeRaw`
      UPDATE "users" SET "roleLevel" = CASE
        WHEN UPPER("role") = 'SUPER_ADMIN' THEN 110
        WHEN UPPER("role") = 'OWNER' THEN 100
        WHEN UPPER("role") = 'ADMIN' THEN 90
        WHEN UPPER("role") = 'MANAGER' THEN 70
        WHEN UPPER("role") = 'FINANCE' THEN 60
        ELSE 30
      END
      WHERE "roleLevel" = 30;
    `;
  } catch (err) {
    console.error('[AdminLogin] Failed to ensure roleLevel column:', err);
  }
}

export async function POST(request: NextRequest) {
  // Self-healing: ensure roleLevel column exists
  await ensureRoleLevelColumn();

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find super admin by email (must be super_admin role)
    // Note: super_admin role already implies tenantId is null in our schema
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        role: 'super_admin',
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Account locked. Try again in ${remainingMinutes} minutes.` },
        { status: 401 }
      );
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= 5;

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
            : 'Invalid admin credentials',
        },
        { status: 401 }
      );
    }

    // Reset failed login attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token pair
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Super admin login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          emailVerified: user.emailVerified,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        permissions: getUserPermissions(user.role),
      },
    });
  } catch (error) {
    console.error('Super admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}