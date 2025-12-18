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

  return NextResponse.json(result);
}
