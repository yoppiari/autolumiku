/**
 * Public Vehicle Detail API
 * Epic 5: Story 5.1 - Vehicle Detail Page
 *
 * GET /api/public/[subdomain]/vehicles/[id] - Get vehicle details
 */

import { NextRequest, NextResponse } from 'next/server';
import { catalogEngineService } from '@/services/catalog/catalog-engine.service';
import { brandingService } from '@/services/catalog/branding.service';
import { seoService } from '@/services/catalog/seo.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string; id: string } }
) {
  try {
    const { subdomain, id } = params;

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    // Get vehicle
    const vehicle = await catalogEngineService.getVehicle(id, branding.tenantId);
    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Get similar vehicles
    const similarVehicles = await catalogEngineService.getSimilarVehicles(
      id,
      branding.tenantId,
      4
    );

    // Generate SEO metadata
    const baseUrl = branding.customDomain
      ? `https://${branding.customDomain}`
      : `https://${branding.subdomain}.autolumiku.com`;

    const seoMetadata = seoService.generateVehicleMetadata(
      vehicle,
      branding,
      baseUrl
    );

    const structuredData = seoService.generateVehicleStructuredData(
      vehicle,
      branding,
      baseUrl
    );

    return NextResponse.json(
      {
        vehicle,
        similarVehicles,
        seo: seoMetadata,
        structuredData,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Public vehicle detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle', details: error.message },
      { status: 500 }
    );
  }
}
