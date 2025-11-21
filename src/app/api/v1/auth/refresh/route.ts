import { NextRequest, NextResponse } from 'next/server';
import { sessionManagementService } from '@/services/session-management.service';
import { refreshTokenSchema, validateRequest } from '@/lib/validation/session-validation';
import { rateLimiters } from '@/middleware/rate-limit';

/**
 * POST /api/v1/auth/refresh - Refresh access token using refresh token
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.refresh(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = validateRequest(refreshTokenSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format'
        },
        { status: 400 }
      );
    }

    const { refreshToken } = validation.data;
    const result = await sessionManagementService.refreshSession(refreshToken);

    return NextResponse.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    // Log detailed error internally, return generic error to client
    console.error('[Auth Error]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed'
      },
      { status: 401 }
    );
  }
}
