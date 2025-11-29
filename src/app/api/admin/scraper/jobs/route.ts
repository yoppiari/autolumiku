/**
 * GET /api/admin/scraper/jobs
 * List all scraper jobs with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (request, auth) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

      const { jobs, total } = await scraperService.getJobs(page, pageSize);

      return NextResponse.json({
        success: true,
        jobs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Get jobs error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get jobs',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
