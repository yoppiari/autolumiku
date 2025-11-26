/**
 * GET /api/public/catalog/[slug]/vehicles/[id] - Get vehicle detail
 */

import { NextRequest, NextResponse } from 'next/server';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import { CatalogEngineService } from '@/lib/services/catalog/catalog-engine.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;

    // Get tenant ID from slug
    const tenantId = await BrandingService.getTenantIdBySlugOrDomain(slug);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    // Get vehicle
    const vehicle = await CatalogEngineService.getVehicleById(id, tenantId);
    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error('Vehicle detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
