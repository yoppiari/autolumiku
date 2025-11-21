import { NextRequest, NextResponse } from 'next/server';
import { sessionManagementService } from '@/services/session-management.service';
import { withTeamAuth, TeamUser } from '@/lib/middleware/team-auth';
import { rateLimiters } from '@/middleware/rate-limit';

/**
 * GET /api/v1/sessions - Get all active sessions for current user
 */
export const GET = withTeamAuth(async (req: NextRequest, user: TeamUser) => {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.session(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const sessions = await sessionManagementService.getUserActiveSessions(user.id);

    // Remove sensitive data
    const safeSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      device: session.device,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      location: session.location,
      isActive: session.isActive
    }));

    return NextResponse.json({
      success: true,
      data: {
        sessions: safeSessions,
        totalCount: safeSessions.length
      }
    });
  } catch (error) {
    // Log detailed error internally, return generic error to client
    console.error('[Session Error]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process request'
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/v1/sessions - Revoke all sessions for current user
 */
export const DELETE = withTeamAuth(async (req: NextRequest, user: TeamUser) => {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.session(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await sessionManagementService.revokeAllUserSessions(user.id);

    return NextResponse.json({
      success: true,
      message: 'Sessions revoked successfully'
    });
  } catch (error) {
    // Log detailed error internally, return generic error to client
    console.error('[Session Error]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process request'
      },
      { status: 500 }
    );
  }
});
