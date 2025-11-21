import { NextRequest, NextResponse } from 'next/server';
import { sessionManagementService } from '@/services/session-management.service';
import { withTeamAuth, TeamUser } from '@/lib/middleware/team-auth';

/**
 * DELETE /api/v1/sessions/[sessionId] - Revoke a specific session
 */
export const DELETE = withTeamAuth(async (
  req: NextRequest,
  user: TeamUser,
  { params }: { params: { sessionId: string } }
) => {
  try {
    const { sessionId } = params;

    // Verify the session belongs to the current user
    const sessions = await sessionManagementService.getUserActiveSessions(user.id);
    const sessionToRevoke = sessions.find(s => s.sessionId === sessionId);

    if (!sessionToRevoke) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found or does not belong to you'
        },
        { status: 404 }
      );
    }

    await sessionManagementService.revokeSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke session'
      },
      { status: 500 }
    );
  }
});
