/**
 * Debug: Fix missing columns in database
 * GET /api/v1/debug/fix-schema
 *
 * Adds missing showroomId columns and showrooms table without Prisma migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    fixes: [],
    tests: {},
  };

  // Fix 1: Create showrooms table if missing (must be first for FK references)
  try {
    const checkTable = await prisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'showrooms'
    `;

    if (checkTable.length === 0) {
      await prisma.$executeRaw`
        CREATE TABLE "showrooms" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "address" TEXT,
          "city" TEXT,
          "province" TEXT,
          "phone" TEXT,
          "whatsappNumber" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "isMain" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "showrooms_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "showrooms_tenantId_fkey" FOREIGN KEY ("tenantId")
            REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "showrooms_tenantId_code_key" ON "showrooms"("tenantId", "code")`;
      await prisma.$executeRaw`CREATE INDEX "showrooms_tenantId_idx" ON "showrooms"("tenantId")`;
      await prisma.$executeRaw`CREATE INDEX "showrooms_isActive_idx" ON "showrooms"("isActive")`;
      results.fixes.push({ table: 'showrooms', status: 'created' });
    } else {
      results.fixes.push({ table: 'showrooms', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ table: 'showrooms', status: 'error', error: err.message });
  }

  // Fix 2: Add showroomId to users table if missing
  try {
    const checkCol = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'showroomId'
    `;

    if (checkCol.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN "showroomId" TEXT`;
      await prisma.$executeRaw`CREATE INDEX "users_showroomId_idx" ON "users"("showroomId")`;
      // Add FK constraint (optional, may fail if showrooms table issues)
      try {
        await prisma.$executeRaw`
          ALTER TABLE "users" ADD CONSTRAINT "users_showroomId_fkey"
          FOREIGN KEY ("showroomId") REFERENCES "showrooms"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
        `;
      } catch (fkErr: any) {
        results.fixes.push({ constraint: 'users_showroomId_fkey', status: 'skipped', reason: fkErr.message });
      }
      results.fixes.push({ column: 'users.showroomId', status: 'added' });
    } else {
      results.fixes.push({ column: 'users.showroomId', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ column: 'users.showroomId', status: 'error', error: err.message });
  }

  // Fix 3: Add showroomId to vehicles table if missing
  try {
    const checkCol = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'showroomId'
    `;

    if (checkCol.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "vehicles" ADD COLUMN "showroomId" TEXT`;
      await prisma.$executeRaw`CREATE INDEX "vehicles_showroomId_idx" ON "vehicles"("showroomId")`;
      // Add FK constraint
      try {
        await prisma.$executeRaw`
          ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_showroomId_fkey"
          FOREIGN KEY ("showroomId") REFERENCES "showrooms"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
        `;
      } catch (fkErr: any) {
        results.fixes.push({ constraint: 'vehicles_showroomId_fkey', status: 'skipped', reason: fkErr.message });
      }
      results.fixes.push({ column: 'vehicles.showroomId', status: 'added' });
    } else {
      results.fixes.push({ column: 'vehicles.showroomId', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ column: 'vehicles.showroomId', status: 'error', error: err.message });
  }

  // Test 1: Verify user query works (same as login)
  try {
    const testUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        showroomId: true,
      },
    });
    results.tests.prismaUserQuery = {
      success: true,
      user: testUser ? { email: testUser.email, role: testUser.role } : null,
    };
  } catch (err: any) {
    results.tests.prismaUserQuery = {
      success: false,
      error: err.message,
      name: err.name,
    };
  }

  // Test 2: Verify user update works
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { updatedAt: new Date() },
      });
      results.tests.prismaUserUpdate = { success: true };
    } else {
      results.tests.prismaUserUpdate = { skipped: 'No admin user found' };
    }
  } catch (err: any) {
    results.tests.prismaUserUpdate = {
      success: false,
      error: err.message,
    };
  }

  // Test 3: Verify vehicles query works
  try {
    const vehicleCount = await prisma.vehicle.count();
    results.tests.prismaVehicleQuery = {
      success: true,
      count: vehicleCount,
    };
  } catch (err: any) {
    results.tests.prismaVehicleQuery = {
      success: false,
      error: err.message,
    };
  }

  // Verify final state - list columns
  try {
    const userCols = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `;
    results.userColumns = userCols.map((c: any) => c.column_name);
    results.hasShowroomId = results.userColumns.includes('showroomId');
  } catch (err: any) {
    results.userColumns = { error: err.message };
  }

  // Summary
  results.allTestsPassed =
    results.tests.prismaUserQuery?.success === true &&
    (results.tests.prismaUserUpdate?.success === true || results.tests.prismaUserUpdate?.skipped) &&
    results.tests.prismaVehicleQuery?.success === true;

  results.loginShouldWork = results.allTestsPassed && results.hasShowroomId;

  return NextResponse.json(results);
}
