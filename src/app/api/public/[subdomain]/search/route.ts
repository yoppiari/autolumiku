/**
 * Public Quick Search API
 * Epic 5: Story 5.6 - Quick Search
 *
 * GET /api/public/[subdomain]/search - Quick search for autocomplete
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
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 5;

    const results = await catalogEngineService.quickSearch(
      branding.tenantId,
      query,
      limit
    );

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('Quick search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    );
  }
}
