/**
 * GET /api/admin/scraper/results/:jobId
 * Get all results for a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const make = searchParams.get('make') || undefined;

    const results = await scraperService.getResults(params.jobId, {
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
}
