/**
 * POST /api/admin/scraper/run
 * Start a new scraper job
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/inventory/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const body = await request.json();
      const { source = 'OLX', targetCount = 50 } = body;

      // TODO: Get user ID from session/auth
      const userId = 'admin'; // Placeholder

      const job = await scraperService.startJob({
        source,
        targetCount,
        executedBy: userId,
      });

      return NextResponse.json({
        success: true,
        data: { job },
      });
    } catch (error) {
      console.error('Start scraper error:', error);
      return NextResponse.json(
        {
          error: 'Failed to start scraper',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
