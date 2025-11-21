/**
 * Restore Version API
 * Epic 4: Story 4.3 - Version History and Audit Trail
 *
 * POST /api/v1/inventory/history/:vehicleId/restore - Restore to specific version
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { versionHistoryService } from '@/services/inventory/version-history.service';

export const POST = withAuth(async (request, { user, params }) => {
  try {
    const vehicleId = params?.vehicleId as string;
    const body = await request.json();
    const { version } = body;

    if (version === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: version',
        },
        { status: 400 }
      );
    }

    const restored = await versionHistoryService.restoreToVersion(
      vehicleId,
      version,
      user.id,
      `${user.firstName} ${user.lastName}`
    );

    return NextResponse.json({
      success: true,
      data: restored,
      message: `Successfully restored to version ${version}`,
    });
  } catch (error) {
    console.error('[Restore Version API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restore version',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
