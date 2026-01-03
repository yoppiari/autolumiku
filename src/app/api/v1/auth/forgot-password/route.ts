import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthGuardService } from '@/lib/services/auth-guard.service';
import { PasswordResetService } from '@/lib/services/password-reset.service';
import type { ForgotPasswordRequest, ForgotPasswordResponse } from '@/types/auth.types';

export async function POST(request: NextRequest) {
  try {
    const body: ForgotPasswordRequest = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: false,
          method: 'unavailable',
          message: 'Email wajib diisi',
          error: 'Email wajib diisi',
        },
        { status: 400 }
      );
    }

    // Find user by email and request context (tenant domain)
    const host = request.headers.get('host') || '';
    const users = await prisma.user.findMany({
      where: { email: email.toLowerCase() },
      include: { tenant: true }
    });

    if (users.length === 0) {
      // For security, don't reveal if email exists
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: true,
          method: 'email',
          message:
            'Jika email terdaftar, instruksi reset password akan dikirim.',
        },
        { status: 200 }
      );
    }

    // Disambiguation
    let user = users[0];
    if (users.length > 1) {
      const match = users.find(u => u.tenant?.domain === host);
      if (match) {
        user = match;
      } else {
        // Find platform admin or first available
        const platform = users.find(u => u.tenantId === null);
        user = platform || users[0];
      }
    }

    // For security, don't reveal if email exists
    if (!user) {
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: true,
          method: 'email',
          message:
            'Jika email terdaftar, instruksi reset password akan dikirim.',
        },
        { status: 200 }
      );
    }

    // Check rate limit
    const rateLimitCheck = await PasswordResetService.checkRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: false,
          method: 'unavailable',
          message: rateLimitCheck.message || 'Terlalu banyak percobaan',
          error: rateLimitCheck.message,
        },
        { status: 429 }
      );
    }

    // Increment rate limit counter
    await PasswordResetService.incrementRateLimitCounter(user.id);

    // Check if user can use WhatsApp reset
    const eligibility = await AuthGuardService.canUseWhatsAppReset(user.id);

    if (!eligibility.eligible) {
      // Super admin or user without WhatsApp - return fallback message
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: false,
          method: 'unavailable',
          message: eligibility.reason || 'Reset via WhatsApp tidak tersedia',
          error: eligibility.reason,
        },
        { status: 400 }
      );
    }

    // Generate OTP
    const { otp, expiresAt } = PasswordResetService.generateOTP();

    // Save OTP to database
    await PasswordResetService.saveOTP(user.id, otp, expiresAt);

    // Send OTP via WhatsApp
    const sendResult = await PasswordResetService.sendOTPViaWhatsApp(
      user.id,
      otp,
      eligibility.tenantId!
    );

    if (!sendResult.success) {
      return NextResponse.json<ForgotPasswordResponse>(
        {
          success: false,
          method: 'whatsapp',
          message: sendResult.error || 'Gagal mengirim OTP',
          error: sendResult.error,
        },
        { status: 500 }
      );
    }

    // Get masked phone number for display
    const tenant = await prisma.tenant.findUnique({
      where: { id: eligibility.tenantId },
      select: {
        aimeowAccount: {
          select: {
            phoneNumber: true,
          },
        },
      },
    });

    const phoneNumber = tenant?.aimeowAccount?.phoneNumber
      ? PasswordResetService.maskPhoneNumber(tenant.aimeowAccount.phoneNumber)
      : undefined;

    return NextResponse.json<ForgotPasswordResponse>(
      {
        success: true,
        method: 'whatsapp',
        message: 'Kode OTP telah dikirim ke WhatsApp showroom Anda',
        phoneNumber,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json<ForgotPasswordResponse>(
      {
        success: false,
        method: 'unavailable',
        message: 'Terjadi kesalahan sistem',
        error: error.message || 'Internal error',
      },
      { status: 500 }
    );
  }
}
