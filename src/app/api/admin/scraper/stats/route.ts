/**
 * GET /api/admin/scraper/stats
 * Get dashboard statistics
 */

import { NextResponse } from 'next/server';
import { scraperService } from '@/lib/services/scraper-service';

export async function GET() {
  try {
    const stats = await scraperService.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
