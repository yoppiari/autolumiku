/**
 * Debug: Fix missing columns in database
 * GET /api/v1/debug/fix-schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    fixes: [],
  };

  // Fix 1: Add showroomId to users table if missing
  try {
    const checkCol = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'showroomId'
    `;

    if (checkCol.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showroomId" TEXT`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "users_showroomId_idx" ON "users"("showroomId")`;
      results.fixes.push({ column: 'users.showroomId', status: 'added' });
    } else {
      results.fixes.push({ column: 'users.showroomId', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ column: 'users.showroomId', status: 'error', error: err.message });
  }

  // Fix 2: Create showrooms table if missing
  try {
    const checkTable = await prisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'showrooms'
    `;

    if (checkTable.length === 0) {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "showrooms" (
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
          CONSTRAINT "showrooms_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_tenantId_code_key" ON "showrooms"("tenantId", "code")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "showrooms_tenantId_idx" ON "showrooms"("tenantId")`;
      results.fixes.push({ table: 'showrooms', status: 'created' });
    } else {
      results.fixes.push({ table: 'showrooms', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ table: 'showrooms', status: 'error', error: err.message });
  }

  // Fix 3: Add showroomId to vehicles table if missing
  try {
    const checkCol = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'vehicles' AND column_name = 'showroomId'
    `;

    if (checkCol.length === 0) {
      await prisma.$executeRaw`ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "showroomId" TEXT`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "vehicles_showroomId_idx" ON "vehicles"("showroomId")`;
      results.fixes.push({ column: 'vehicles.showroomId', status: 'added' });
    } else {
      results.fixes.push({ column: 'vehicles.showroomId', status: 'already exists' });
    }
  } catch (err: any) {
    results.fixes.push({ column: 'vehicles.showroomId', status: 'error', error: err.message });
  }

  // Verify final state
  try {
    const userCols = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    results.userColumns = userCols.map((c: any) => c.column_name);
  } catch (err: any) {
    results.userColumns = { error: err.message };
  }

  return NextResponse.json(results);
}
