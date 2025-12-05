import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateTokenPair } from '@/lib/auth/jwt';
import { getUserPermissions } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  console.log('[Login] Starting login request - HIT');
  console.log('[Login] Request headers:', JSON.stringify(Object.fromEntries(request.headers)));
  try {
    const body = await request.json();
    const { email, password } = body;
    console.log(`[Login] Attempting login for email: ${email}`);

    // Validate input
    if (!email || !password) {
      console.log('[Login] Missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    console.log('[Login] Querying database for user...');
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
      console.log('[Login] User not found');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    console.log(`[Login] User found: ${user.id}, Role: ${user.role}`);

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
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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