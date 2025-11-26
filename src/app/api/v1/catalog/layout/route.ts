/**
 * GET/PUT /api/v1/catalog/layout
 * Catalog layout configuration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { LayoutService } from '@/lib/services/catalog/layout.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    let layout = await LayoutService.getLayout(tenantId);

    // If no layout exists, return default
    if (!layout) {
      layout = LayoutService.getDefaultLayout(tenantId);
    }

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Get layout error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get layout',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      layoutType,
      heroEnabled,
      heroTitle,
      heroSubtitle,
      heroImageUrl,
      featuredVehicleIds,
      sectionOrder,
      navigationMenu,
      vehiclesPerPage,
      showPriceRange,
      showVehicleCount,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const layout = await LayoutService.upsertLayout({
      tenantId,
      layoutType: layoutType || 'GRID',
      heroEnabled: heroEnabled !== undefined ? heroEnabled : true,
      heroTitle,
      heroSubtitle,
      heroImageUrl,
      featuredVehicleIds: featuredVehicleIds || [],
      sectionOrder: sectionOrder || ['hero', 'featured', 'filters', 'vehicles'],
      navigationMenu,
      vehiclesPerPage: vehiclesPerPage || 12,
      showPriceRange: showPriceRange !== undefined ? showPriceRange : true,
      showVehicleCount: showVehicleCount !== undefined ? showVehicleCount : true,
    });

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Update layout error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update layout',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
