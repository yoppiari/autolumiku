/**
 * GET /api/admin/scraper/results/:jobId
 * Get all results for a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const { jobId } = await params;
      const searchParams = request.nextUrl.searchParams;
      const status = searchParams.get('status') || undefined;
      const make = searchParams.get('make') || undefined;

      const results = await scraperService.getResults(jobId, {
        status,
        make,
      });

      // Convert BigInt to string for JSON serialization
      const serializedResults = results.map(result => ({
        ...result,
        price: result.price.toString(),
      }));

      return NextResponse.json({
        success: true,
        results: serializedResults,
        count: results.length,
      });
    } catch (error) {
      console.error('Get results error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get results',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
