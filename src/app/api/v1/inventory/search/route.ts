/**
 * Advanced Search API
 * Epic 4: Story 4.7 - Inventory Search and Filtering
 *
 * POST /api/v1/inventory/search - Advanced search with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { advancedSearchService } from '@/services/inventory/advanced-search.service';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { filters, options } = body;

    const results = await advancedSearchService.search(
      user.tenantId,
      filters || {},
      options || {}
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Inventory Search API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search inventory',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
