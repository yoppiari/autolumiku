/**
 * Debug: Check if user exists and can be queried
 * GET /api/v1/debug/user-check?email=admin@primamobil.id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 });
  }

  const result: any = {
    email,
    timestamp: new Date().toISOString(),
  };

  // Test 1: Raw query
  try {
    const rawResult = await prisma.$queryRaw`
      SELECT id, email, "firstName", "lastName", role, "tenantId"
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;
    result.rawQuery = {
      success: true,
      data: rawResult,
    };
  } catch (err: any) {
    result.rawQuery = {
      success: false,
      error: err.message,
      code: err.code,
    };
  }

  // Test 2: Prisma findFirst (simpler than findUnique)
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });
    result.prismaFindFirst = {
      success: true,
      data: user,
    };
  } catch (err: any) {
    result.prismaFindFirst = {
      success: false,
      error: err.message,
      code: err.code,
      name: err.name,
    };
  }

  // Test 3: Prisma findUnique (what login uses)
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });
    result.prismaFindUnique = {
      success: true,
      data: user,
    };
  } catch (err: any) {
    result.prismaFindUnique = {
      success: false,
      error: err.message,
      code: err.code,
      name: err.name,
    };
  }

  // Test 4: Check table structure
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    result.tableColumns = columns;
  } catch (err: any) {
    result.tableColumns = { error: err.message };
  }

  // Test 5: Same query as login (with all fields)
  try {
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
    result.loginQuery = {
      success: true,
      hasPassword: !!user?.passwordHash,
      data: user ? { ...user, passwordHash: '[REDACTED]' } : null,
    };
  } catch (err: any) {
    result.loginQuery = {
      success: false,
      error: err.message,
      code: err.code,
      name: err.name,
    };
  }

  // Test 6: Update operation (like login does)
  try {
    // Only test update if we found the user
    if (result.loginQuery?.success && result.loginQuery?.data) {
      const userId = result.loginQuery.data.id;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
        select: {
          id: true,
          lastLoginAt: true,
        },
      });
      result.updateTest = {
        success: true,
        data: updated,
      };
    } else {
      result.updateTest = { skipped: 'No user found' };
    }
  } catch (err: any) {
    result.updateTest = {
      success: false,
      error: err.message,
      code: err.code,
      name: err.name,
    };
  }

  // Test 7: Check if showroomId column exists
  try {
    const showroomCol = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'showroomId'
    `;
    result.showroomIdColumn = {
      exists: Array.isArray(showroomCol) && showroomCol.length > 0,
      data: showroomCol,
    };
  } catch (err: any) {
    result.showroomIdColumn = { error: err.message };
  }

  // Test 8: Check migrations table
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY started_at DESC
      LIMIT 5
    `;
    result.migrations = migrations;
  } catch (err: any) {
    result.migrations = { error: err.message };
  }

  return NextResponse.json(result);
}
