/**
 * POST /api/admin/scraper/approve/:resultId
 * Approve a specific result
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/inventory/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: any }
) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const { resultId } = await params;
      // TODO: Get user ID from session
      const userId = 'admin';

      const result = await scraperService.approveResult(resultId, userId);

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Approve result error:', error);
      return NextResponse.json(
        {
          error: 'Failed to approve result',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
