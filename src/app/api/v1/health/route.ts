/**
 * Health Check Endpoint
 * GET /api/v1/health
 * Used to verify database connection and system status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // Check database connection
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'connected',
      latency: `${Date.now() - start}ms`,
    };

    // Check tenant count
    const tenantCount = await prisma.tenant.count();
    checks.tenants = tenantCount;

    // Check user count
    const userCount = await prisma.user.count();
    checks.users = userCount;

    // Check vehicle count
    const vehicleCount = await prisma.vehicle.count();
    checks.vehicles = vehicleCount;

  } catch (dbError: any) {
    checks.status = 'degraded';
    checks.database = {
      status: 'error',
      error: dbError.message,
      code: dbError.code,
      name: dbError.name,
    };
  }

  // Check environment variables
  checks.env = {
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING (using default)',
    REDIS_URL: process.env.REDIS_URL ? 'set' : 'not set',
  };

  const statusCode = checks.status === 'ok' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
