/**
 * GET /api/admin/scraper/status/:jobId
 * Get status of a specific job
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const job = await scraperService.getJob(params.jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
