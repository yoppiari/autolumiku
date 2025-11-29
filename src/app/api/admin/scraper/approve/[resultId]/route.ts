/**
 * POST /api/admin/scraper/approve/:resultId
 * Approve a specific result
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: { resultId: string } }
) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      // TODO: Get user ID from session
      const userId = 'admin';

      const result = await scraperService.approveResult(params.resultId, userId);

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
