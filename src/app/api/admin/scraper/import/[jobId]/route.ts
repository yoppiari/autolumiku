/**
 * POST /api/admin/scraper/import/:jobId
 * Import approved results to production
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const options = body.options || {};

    const result = await scraperService.importResults(params.jobId, options);

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
}
