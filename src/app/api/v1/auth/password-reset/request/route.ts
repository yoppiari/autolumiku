/**
 * Password Reset Request API
 * Part of Story 1.7: User Account Creation & Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const requestSchema = z.object({
  email: z.string().email()
});

/**
 * POST /api/v1/auth/password-reset/request
 * Request password reset email
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.auth(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const resetToken = await authService.requestPasswordReset(validation.data.email);

    // TODO: Send password reset email
    console.log(`Password reset email should be sent to ${validation.data.email} with token: ${resetToken}`);

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      messageIndonesian: 'Jika email terdaftar, link reset password telah dikirim'
    });
  } catch (error) {
    console.error('[Password Reset Request API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Password reset request failed' },
      { status: 500 }
    );
  }
}
