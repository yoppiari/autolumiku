/**
 * Public Catalog API
 * Epic 5: Story 5.1 - Public Vehicle Catalog
 *
 * GET /api/public/[subdomain]/catalog - Get vehicle catalog with filters
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

    // Parse filters
    const filters = {
      make: searchParams.get('make') || undefined,
      model: searchParams.get('model') || undefined,
      yearMin: searchParams.get('yearMin') ? parseInt(searchParams.get('yearMin')!) : undefined,
      yearMax: searchParams.get('yearMax') ? parseInt(searchParams.get('yearMax')!) : undefined,
      priceMin: searchParams.get('priceMin') ? parseInt(searchParams.get('priceMin')!) : undefined,
      priceMax: searchParams.get('priceMax') ? parseInt(searchParams.get('priceMax')!) : undefined,
      transmission: searchParams.get('transmission') || undefined,
      fuelType: searchParams.get('fuelType') || undefined,
      search: searchParams.get('search') || undefined,
      categories: searchParams.get('categories')?.split(',') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
    };

    // Parse options
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12,
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const result = await catalogEngineService.getCatalog(
      branding.tenantId,
      filters,
      options
    );

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('Public catalog error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog', details: error.message },
      { status: 500 }
    );
  }
}
