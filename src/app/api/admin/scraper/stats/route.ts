/**
 * GET /api/admin/scraper/stats
 * Get dashboard statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/inventory/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const stats = await scraperService.getStats();

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get stats',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
