/**
 * User Registration API
 * Part of Story 1.7: User Account Creation & Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^(\+62|62|0)[0-9]{9,12}$/).optional(),
  tenantId: z.string().uuid()
});

/**
 * POST /api/v1/auth/register
 * Register a new user account
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting - 5 registrations per 15 minutes
    const rateLimitResponse = await rateLimiters.auth(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = registerSchema.safeParse(body);

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

    const { user, verificationToken } = await authService.register(validation.data);

    // TODO: Send verification email
    logger.info(`Verification email should be sent to ${user.email} with token: ${verificationToken}`);

    return NextResponse.json({
      success: true,
      data: {
        user,
        message: 'Registration successful. Please check your email to verify your account.',
        messageIndonesian: 'Registrasi berhasil. Silakan periksa email Anda untuk verifikasi akun.'
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Register API Error]', error);

    // Handle specific errors
    if (error.message === 'Email already registered') {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already registered',
          errorIndonesian: 'Email sudah terdaftar'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
