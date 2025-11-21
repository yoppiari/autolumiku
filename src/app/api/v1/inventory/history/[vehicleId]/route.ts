/**
 * Version History API
 * Epic 4: Story 4.3 - Version History and Audit Trail
 *
 * GET /api/v1/inventory/history/:vehicleId - Get version history
 * POST /api/v1/inventory/history/:vehicleId/restore - Restore to version
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { versionHistoryService } from '@/services/inventory/version-history.service';

export const GET = withAuth(async (request, { user, params }) => {
  try {
    const vehicleId = params?.vehicleId as string;
    const { searchParams } = request.nextUrl;

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') || undefined;

    const history = await versionHistoryService.getHistory(vehicleId, {
      limit,
      offset,
      action,
    });

    const stats = await versionHistoryService.getHistoryStats(vehicleId);

    return NextResponse.json({
      success: true,
      data: {
        history,
        stats,
      },
    });
  } catch (error) {
    console.error('[Version History API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get version history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
