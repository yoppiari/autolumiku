/**
 * POST /api/admin/scraper/import/:jobId
 * Import approved results to production
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: any }
) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const { jobId } = await params;
      const body = await request.json().catch(() => ({}));
      const options = body.options || {};

      const result = await scraperService.importResults(jobId, options);

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Import results error:', error);
      return NextResponse.json(
        {
          error: 'Failed to import results',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
