/**
 * Leasing Partners API
 * GET /api/v1/leasing-partners - List leasing partners
 * POST /api/v1/leasing-partners - Create leasing partner
 *
 * Protected: Requires authentication + admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

// Minimum role level to manage leasing partners
const MIN_ROLE_LEVEL_VIEW = 60; // FINANCE and above can view
const MIN_ROLE_LEVEL_MANAGE = 90; // ADMIN and above can create/edit

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL_VIEW) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const tenantId = auth.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const partners = await prisma.leasingPartner.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: partners,
    });
  } catch (error) {
    console.error('[Leasing Partners API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leasing partners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL_MANAGE) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      code,
      interestRateMin,
      interestRateMax,
      interestType,
      tenorOptions,
      dpMinPercent,
      adminFee,
      contactPerson,
      phone,
      email,
    } = body;
    const tenantId = auth.user.tenantId;

    if (!tenantId || !name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    // Check if code already exists
    const existing = await prisma.leasingPartner.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Leasing partner with this code already exists' }, { status: 409 });
    }

    const partner = await prisma.leasingPartner.create({
      data: {
        tenantId,
        name,
        code: code.toUpperCase(),
        interestRateMin: interestRateMin || 0,
        interestRateMax: interestRateMax || 0,
        interestType: interestType || 'flat',
        tenorOptions: tenorOptions || '12,24,36,48,60',
        dpMinPercent: dpMinPercent || 20,
        adminFee: adminFee || 0,
        contactPerson,
        phone,
        email,
      },
    });

    return NextResponse.json({
      success: true,
      data: partner,
      message: 'Leasing partner created successfully',
    });
  } catch (error) {
    console.error('[Leasing Partners API] Create error:', error);
    return NextResponse.json({ error: 'Failed to create leasing partner' }, { status: 500 });
  }
}
