/**
 * Public Tenant Info API
 * Returns tenant data from middleware headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get tenant info from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id');
    const tenantSlug = request.headers.get('x-tenant-slug');

    if (!tenantId || !tenantSlug) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get full tenant data
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        theme: true,
        selectedTheme: true,
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

    // Get branding
    const branding = await BrandingService.getBrandingBySlugOrDomain(tenantSlug);

    return NextResponse.json({
      tenant,
      branding,
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
