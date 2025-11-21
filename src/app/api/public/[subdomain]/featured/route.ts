/**
 * Public Featured Vehicles API
 * Epic 5: Story 5.4 - Featured Vehicles & Homepage
 *
 * GET /api/public/[subdomain]/featured - Get featured vehicles
 */

import { NextRequest, NextResponse } from 'next/server';
import { catalogEngineService } from '@/services/catalog/catalog-engine.service';
import { brandingService } from '@/services/catalog/branding.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 6;

    const featuredVehicles = await catalogEngineService.getFeaturedVehicles(
      branding.tenantId,
      limit
    );

    return NextResponse.json(
      { vehicles: featuredVehicles },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Featured vehicles error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured vehicles', details: error.message },
      { status: 500 }
    );
  }
}
