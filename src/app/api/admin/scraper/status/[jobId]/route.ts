/**
 * GET /api/admin/scraper/status/:jobId
 * Get status of a specific job
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/inventory/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const { jobId } = await params;
      const job = await scraperService.getJob(jobId);

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
  });
}
