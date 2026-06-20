/**
 * PUT /api/v1/tenants/[id]/business-info
 * Update tenant business information
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;

    // Cross-tenant IDOR protection: users may only modify their own tenant
    if (!isSuperAdmin && id !== authGate.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      phoneNumber,
      phoneNumberSecondary,
      whatsappNumber,
      email,
      address,
      city,
      province,
      postalCode,
      googleMapsUrl,
      latitude,
      longitude,
      businessHours,
      socialMedia,
    } = body;

    // Update tenant business info
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        phoneNumber,
        phoneNumberSecondary,
        whatsappNumber,
        email,
        address,
        city,
        province,
        postalCode,
        googleMapsUrl,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        businessHours,
        socialMedia,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedTenant,
    });
  } catch (error) {
    console.error('Update business info error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update business information',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;

    // Cross-tenant IDOR protection: users may only read their own tenant
    if (!isSuperAdmin && id !== authGate.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        phoneNumberSecondary: true,
        whatsappNumber: true,
        email: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        googleMapsUrl: true,
        latitude: true,
        longitude: true,
        businessHours: true,
        socialMedia: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('Get business info error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get business information',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
