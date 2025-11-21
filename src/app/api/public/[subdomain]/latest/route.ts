/**
 * Public Latest Vehicles API
 * Epic 5: Story 5.4 - Latest Vehicles
 *
 * GET /api/public/[subdomain]/latest - Get latest vehicles
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
      : 12;

    const latestVehicles = await catalogEngineService.getLatestVehicles(
      branding.tenantId,
      limit
    );

    return NextResponse.json(
      { vehicles: latestVehicles },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Latest vehicles error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest vehicles', details: error.message },
      { status: 500 }
    );
  }
}
