/**
 * Email Verification API
 * Part of Story 1.7: User Account Creation & Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth-service';
import { rateLimiters } from '@/middleware/rate-limit';

/**
 * POST /api/v1/auth/verify-email
 * Verify user email with token
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token required' },
        { status: 400 }
      );
    }

    await authService.verifyEmail(token);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      messageIndonesian: 'Email berhasil diverifikasi'
    });
  } catch (error: any) {
    console.error('[Verify Email API Error]', error);

    if (error.message.includes('Invalid verification token') ||
        error.message.includes('Verification token expired')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorIndonesian: error.message.includes('expired')
            ? 'Token verifikasi sudah kadaluarsa'
            : 'Token verifikasi tidak valid'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Email verification failed' },
      { status: 500 }
    );
  }
}
