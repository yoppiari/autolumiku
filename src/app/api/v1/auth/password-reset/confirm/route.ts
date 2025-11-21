/**
 * Password Reset Confirmation API
 * Part of Story 1.7: User Account Creation & Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const confirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

/**
 * POST /api/v1/auth/password-reset/confirm
 * Confirm password reset with token and new password
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = confirmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    await authService.resetPassword(validation.data.token, validation.data.newPassword);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      messageIndonesian: 'Password berhasil direset'
    });
  } catch (error: any) {
    console.error('[Password Reset Confirm API Error]', error);

    if (error.message.includes('Invalid reset token') ||
        error.message.includes('Reset token expired')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorIndonesian: error.message.includes('expired')
            ? 'Token reset sudah kadaluarsa'
            : 'Token reset tidak valid'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Password reset failed' },
      { status: 500 }
    );
  }
}
