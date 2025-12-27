/**
 * Sales Customer API
 * GET /api/v1/sales-customers - List customers
 * POST /api/v1/sales-customers - Create customer
 *
 * Protected: Requires authentication + finance/admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

// Minimum role level to access invoice features
const MIN_ROLE_LEVEL = 60; // FINANCE and above

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  // Check role level
  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = auth.user.tenantId;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const where: any = { tenantId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.salesCustomer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { salesInvoices: true } },
        },
      }),
      prisma.salesCustomer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Sales Customers API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, type, phone, email, address, nik, npwp, source, notes } = body;
    const tenantId = auth.user.tenantId;

    if (!tenantId || !name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '62' + normalizedPhone.substring(1);
    }

    // Check if customer already exists
    const existing = await prisma.salesCustomer.findUnique({
      where: { tenantId_phone: { tenantId, phone: normalizedPhone } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Customer with this phone already exists' }, { status: 409 });
    }

    const customer = await prisma.salesCustomer.create({
      data: {
        tenantId,
        name,
        type: type || 'individual',
        phone: normalizedPhone,
        email,
        address,
        nik,
        npwp,
        source: source || 'manual',
        notes,
        createdBy: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('[Sales Customers API] Create error:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
