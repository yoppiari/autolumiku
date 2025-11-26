/**
 * GET /api/public/catalog/[slug] - Get catalog vehicles for tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import { CatalogEngineService } from '@/lib/services/catalog/catalog-engine.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // Get tenant ID from slug
    const tenantId = await BrandingService.getTenantIdBySlugOrDomain(slug);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    // Parse filters from query params
    const filters = {
      search: searchParams.get('search') || undefined,
      make: searchParams.get('make') || undefined,
      minPrice: searchParams.get('minPrice')
        ? parseFloat(searchParams.get('minPrice')!)
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? parseFloat(searchParams.get('maxPrice')!)
        : undefined,
      minYear: searchParams.get('minYear')
        ? parseInt(searchParams.get('minYear')!)
        : undefined,
      maxYear: searchParams.get('maxYear')
        ? parseInt(searchParams.get('maxYear')!)
        : undefined,
      transmissionType: searchParams.get('transmissionType') || undefined,
      fuelType: searchParams.get('fuelType') || undefined,
      sortBy:
        (searchParams.get('sortBy') as any) || 'date-desc',
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!)
        : 1,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 12,
    };

    // Get vehicles
    const result = await CatalogEngineService.getVehicles(tenantId, filters);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Catalog API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load catalog',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
