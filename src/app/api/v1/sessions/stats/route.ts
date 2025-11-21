import { NextRequest, NextResponse } from 'next/server';
import { sessionManagementService } from '@/services/session-management.service';
import { requirePermission } from '@/lib/middleware/team-auth';

/**
 * GET /api/v1/sessions/stats - Get session statistics (admin only)
 */
export const GET = requirePermission('system:admin')(async (req: NextRequest) => {
  try {
    const stats = await sessionManagementService.getSessionStats();

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get session stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve session statistics'
      },
      { status: 500 }
    );
  }
});
