/**
 * Debug endpoint for dashboard troubleshooting
 * GET /api/v1/debug/dashboard?slug=primamobil-id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'primamobil-id';
    const tenantId = searchParams.get('tenantId');

    // 1. Get tenant info
    const tenant = await prisma.tenant.findFirst({
      where: tenantId ? { id: tenantId } : { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        status: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({
        error: 'Tenant not found',
        hint: `No tenant with slug "${slug}" or id "${tenantId}"`,
      }, { status: 404 });
    }

    // 2. Get vehicles count for this tenant
    const vehiclesCount = await prisma.vehicle.count({
      where: { tenantId: tenant.id },
    });

    // 3. Get recent vehicles
    const recentVehicles = await prisma.vehicle.findMany({
      where: { tenantId: tenant.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        year: true,
        status: true,
        createdAt: true,
        createdBy: true,
      },
    });

    // 4. Get users for this tenant
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
      },
    });

    // 5. Check AimeowAccount
    const aimeowAccount = await prisma.aimeowAccount.findFirst({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        clientId: true,
        phoneNumber: true,
        isActive: true,
        connectionStatus: true,
      },
    });

    return NextResponse.json({
      tenant,
      vehiclesCount,
      recentVehicles,
      users: users.map(u => ({
        ...u,
        phone: u.phone ? `${u.phone.slice(0, 4)}****${u.phone.slice(-4)}` : null, // Mask phone for privacy
      })),
      aimeowAccount,
      instructions: {
        dashboardLogin: 'Use one of the user emails above to login at /login',
        localStorage: `After login, localStorage should have: { user: { tenantId: "${tenant.id}" } }`,
        apiCheck: `Test API: GET /api/v1/vehicles?tenantId=${tenant.id}`,
      },
    });

  } catch (error: any) {
    console.error('[Debug Dashboard] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
