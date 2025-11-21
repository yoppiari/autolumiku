/**
 * User Login API
 * Part of Story 1.7: User Account Creation & Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * POST /api/v1/auth/login
 * Login user with email and password
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting - 5 login attempts per 15 minutes
    const rateLimitResponse = await rateLimiters.auth(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const result = await authService.login(validation.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens
      }
    });
  } catch (error: any) {
    console.error('[Login API Error]', error);

    // Generic error messages for security
    if (error.message.includes('Invalid credentials') ||
        error.message.includes('Email not verified') ||
        error.message.includes('Account locked')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          errorIndonesian: 'Autentikasi gagal',
          details: error.message
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
