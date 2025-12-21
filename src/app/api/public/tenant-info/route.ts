/**
 * Public Tenant Info API
 * Returns tenant data based on request host/domain
 *
 * NOTE: API routes are excluded from middleware, so we read host directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BrandingService } from '@/lib/services/catalog/branding.service';

export const dynamic = 'force-dynamic';

// Domain to slug mapping (same as middleware)
const domainToSlug: Record<string, string> = {
  'primamobil.id': 'primamobil-id',
  'www.primamobil.id': 'primamobil-id',
};

export async function GET(request: NextRequest) {
  try {
    // Get host from request headers (API routes don't get middleware headers)
    const host = request.headers.get('host') || '';
    const cleanHost = host.split(':')[0]; // Remove port

    console.log('[tenant-info] Host:', cleanHost);

    // Check if this is a known custom domain
    const tenantSlug = domainToSlug[cleanHost];

    let tenant = null;
    let branding = null;

    if (tenantSlug) {
      // Custom domain - lookup by slug
      console.log('[tenant-info] Custom domain detected, slug:', tenantSlug);

      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { slug: tenantSlug },
            { slug: tenantSlug.replace(/-id$/, '') }, // Fallback without -id suffix
          ],
          status: 'active',
        },
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
          whatsappNumber: true,
          email: true,
          address: true,
          city: true,
        },
      });

      if (tenant) {
        branding = await BrandingService.getBrandingBySlugOrDomain(tenant.slug);
      }
    } else {
      // Try lookup by domain directly
      console.log('[tenant-info] Looking up by domain:', cleanHost);

      tenant = await prisma.tenant.findFirst({
        where: {
          domain: cleanHost,
          status: 'active',
        },
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
          whatsappNumber: true,
          email: true,
          address: true,
          city: true,
        },
      });

      if (tenant) {
        branding = await BrandingService.getBrandingBySlugOrDomain(tenant.slug);
      }
    }

    if (!tenant) {
      console.log('[tenant-info] No tenant found for host:', cleanHost);
      return NextResponse.json(
        { error: 'Tenant not found', host: cleanHost },
        { status: 404 }
      );
    }

    console.log('[tenant-info] Found tenant:', tenant.name);

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
