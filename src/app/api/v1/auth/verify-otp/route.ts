import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PasswordResetService } from '@/lib/services/security/password-reset.service';
import type { VerifyOTPRequest, VerifyOTPResponse } from '@/types/auth.types';

export async function POST(request: NextRequest) {
  try {
    const body: VerifyOTPRequest = await request.json();
    const { email, otp } = body;

    // Validate input
    if (!email || !otp) {
      return NextResponse.json<VerifyOTPResponse>(
        {
          success: false,
          message: 'Email dan kode OTP wajib diisi',
          error: 'Email dan kode OTP wajib diisi',
        },
        { status: 400 }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json<VerifyOTPResponse>(
        {
          success: false,
          message: 'Kode OTP harus 6 digit angka',
          error: 'Format OTP tidak valid',
        },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json<VerifyOTPResponse>(
        {
          success: false,
          message: 'Email tidak ditemukan',
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Verify OTP
    const verificationResult = await PasswordResetService.verifyOTP(
      user.id,
      otp
    );

    if (!verificationResult.valid) {
      return NextResponse.json<VerifyOTPResponse>(
        {
          success: false,
          message: verificationResult.error || 'Kode OTP tidak valid',
          error: verificationResult.error,
          attemptsLeft: verificationResult.attemptsLeft,
        },
        { status: 400 }
      );
    }

    // Generate reset token
    const resetToken = PasswordResetService.generateResetToken(user.id);
    const expiresIn = 15 * 60; // 15 minutes in seconds

    // Log successful OTP verification
    if (user.tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'PASSWORD_RESET_OTP_VERIFIED',
          resourceType: 'User',
          resourceId: user.id,
          metadata: {
            email: user.email,
          },
          ipAddress: request.headers.get('x-forwarded-for') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    }

    return NextResponse.json<VerifyOTPResponse>(
      {
        success: true,
        resetToken,
        expiresIn,
        message: 'Kode OTP valid. Silakan buat password baru.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json<VerifyOTPResponse>(
      {
        success: false,
        message: 'Terjadi kesalahan sistem',
        error: error.message || 'Internal error',
      },
      { status: 500 }
    );
  }
}
