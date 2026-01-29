/**
 * GET /api/v1/popular-vehicles/search?q={query}
 *
 * Search popular vehicles for auto-complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { popularVehicleService } from '@/lib/services/inventory/popular-vehicle-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const results = await popularVehicleService.searchVehicles(query, limit);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Search popular vehicles error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search vehicles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
