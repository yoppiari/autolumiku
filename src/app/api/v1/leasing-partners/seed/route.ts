/**
 * Leasing Partners Seed API
 * POST /api/v1/leasing-partners/seed - Seed default leasing partners
 *
 * Protected: Requires authentication + admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

const MIN_ROLE_LEVEL = 90; // ADMIN and above

// Default leasing partners data for Indonesian market
const DEFAULT_LEASING_PARTNERS = [
  {
    name: 'Adira Dinamika Multi Finance',
    code: 'ADIRA',
    interestRateMin: 3.5,
    interestRateMax: 6.5,
    interestType: 'flat',
    tenorOptions: '12,18,24,36,48,60',
    dpMinPercent: 20,
    adminFee: 500000,
  },
  {
    name: 'FIFGROUP (Federal International Finance)',
    code: 'FIF',
    interestRateMin: 3.0,
    interestRateMax: 6.0,
    interestType: 'flat',
    tenorOptions: '12,18,24,36,48',
    dpMinPercent: 20,
    adminFee: 400000,
  },
  {
    name: 'Bussan Auto Finance',
    code: 'BAF',
    interestRateMin: 3.5,
    interestRateMax: 7.0,
    interestType: 'flat',
    tenorOptions: '12,18,24,36,48,60',
    dpMinPercent: 25,
    adminFee: 500000,
  },
  {
    name: 'WOM Finance (Wahana Ottomitra Multiartha)',
    code: 'WOM',
    interestRateMin: 4.0,
    interestRateMax: 7.5,
    interestType: 'flat',
    tenorOptions: '12,18,24,36,48',
    dpMinPercent: 20,
    adminFee: 450000,
  },
  {
    name: 'BCA Finance',
    code: 'BCAF',
    interestRateMin: 3.0,
    interestRateMax: 5.5,
    interestType: 'flat',
    tenorOptions: '12,24,36,48,60',
    dpMinPercent: 25,
    adminFee: 600000,
  },
  {
    name: 'BCA Multifinance',
    code: 'BCAM',
    interestRateMin: 3.5,
    interestRateMax: 6.0,
    interestType: 'flat',
    tenorOptions: '12,24,36,48,60',
    dpMinPercent: 20,
    adminFee: 550000,
  },
];

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    const tenantId = auth.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Check existing partners
    const existingCount = await prisma.leasingPartner.count({
      where: { tenantId },
    });

    if (existingCount > 0) {
      return NextResponse.json({
        success: false,
        error: 'Leasing partners already exist for this tenant',
        existingCount,
      }, { status: 409 });
    }

    // Create all partners
    const created = await prisma.leasingPartner.createMany({
      data: DEFAULT_LEASING_PARTNERS.map(partner => ({
        tenantId,
        ...partner,
      })),
    });

    // Fetch created partners
    const partners = await prisma.leasingPartner.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      message: `${created.count} leasing partners created successfully`,
      data: partners,
    });
  } catch (error) {
    console.error('[Leasing Partners Seed API] Error:', error);
    return NextResponse.json({ error: 'Failed to seed leasing partners' }, { status: 500 });
  }
}
