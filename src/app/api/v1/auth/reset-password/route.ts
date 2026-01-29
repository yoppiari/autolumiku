import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PasswordResetService } from '@/lib/services/security/password-reset.service';
import type { ResetPasswordRequest, ResetPasswordResponse } from '@/types/auth.types';

export async function POST(request: NextRequest) {
  try {
    const body: ResetPasswordRequest = await request.json();
    const { resetToken, newPassword } = body;

    // Validate input
    if (!resetToken || !newPassword) {
      return NextResponse.json<ResetPasswordResponse>(
        {
          success: false,
          message: 'Token dan password baru wajib diisi',
          error: 'Token dan password baru wajib diisi',
        },
        { status: 400 }
      );
    }

    // Verify reset token
    const tokenVerification = PasswordResetService.verifyResetToken(resetToken);

    if (!tokenVerification.valid || !tokenVerification.userId) {
      return NextResponse.json<ResetPasswordResponse>(
        {
          success: false,
          message: tokenVerification.error || 'Token tidak valid atau sudah kadaluarsa',
          error: tokenVerification.error,
        },
        { status: 400 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: tokenVerification.userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json<ResetPasswordResponse>(
        {
          success: false,
          message: 'User tidak ditemukan',
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Reset password
    const resetResult = await PasswordResetService.resetPassword(
      user.id,
      newPassword,
      user.tenantId || undefined
    );

    if (!resetResult.success) {
      return NextResponse.json<ResetPasswordResponse>(
        {
          success: false,
          message: resetResult.error || 'Gagal mereset password',
          error: resetResult.error,
        },
        { status: 400 }
      );
    }

    // Log successful password reset
    if (user.tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'PASSWORD_RESET_SUCCESS',
          resourceType: 'User',
          resourceId: user.id,
          metadata: {
            email: user.email,
            method: 'whatsapp_otp',
          },
          ipAddress: request.headers.get('x-forwarded-for') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    }

    return NextResponse.json<ResetPasswordResponse>(
      {
        success: true,
        message: 'Password berhasil direset. Silakan login dengan password baru.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json<ResetPasswordResponse>(
      {
        success: false,
        message: 'Terjadi kesalahan sistem',
        error: error.message || 'Internal error',
      },
      { status: 500 }
    );
  }
}
