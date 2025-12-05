/**
 * Password Reset Service
 * Handles OTP generation, WhatsApp sending, verification, and password reset
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { AimeowClientService } from './aimeow/aimeow-client.service';
import type {
  OTPGenerationResult,
  RateLimitCheck,
} from '@/types/auth.types';

export class PasswordResetService {
  /**
   * Generate a 6-digit OTP
   */
  static generateOTP(): OTPGenerationResult {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    return { otp, expiresAt };
  }

  /**
   * Check rate limit for password reset requests
   * Limit: 3 requests per hour per user
   */
  static async checkRateLimit(userId: string): Promise<RateLimitCheck> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        resetRequestCount: true,
        resetRequestWindow: true,
      },
    });

    if (!user) {
      return { allowed: false, message: 'User not found' };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Reset window if expired
    if (!user.resetRequestWindow || user.resetRequestWindow < oneHourAgo) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          resetRequestCount: 0,
          resetRequestWindow: now,
        },
      });
      return { allowed: true, remainingAttempts: 3 };
    }

    // Check if user exceeded limit
    if (user.resetRequestCount >= 3) {
      const resetAt = new Date(user.resetRequestWindow.getTime() + 60 * 60 * 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        resetAt,
        message: `Terlalu banyak percobaan. Silakan coba lagi setelah ${resetAt.toLocaleTimeString('id-ID')}.`,
      };
    }

    return {
      allowed: true,
      remainingAttempts: 3 - user.resetRequestCount,
    };
  }

  /**
   * Increment rate limit counter
   */
  static async incrementRateLimitCounter(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetRequestCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Send OTP via WhatsApp
   */
  static async sendOTPViaWhatsApp(
    userId: string,
    otp: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tenant's WhatsApp account
      const account = await AimeowClientService.getAccountByTenant(tenantId);

      if (!account || !account.isActive || account.connectionStatus !== 'connected') {
        return {
          success: false,
          error: 'WhatsApp tidak terhubung. Silakan hubungi administrator.',
        };
      }

      // Get user info for audit
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Send OTP message via WhatsApp bot
      const message = `🔐 *Kode OTP Reset Password*\n\nHalo! Berikut adalah kode OTP untuk reset password:\n\n*${otp}*\n\n✅ Berlaku selama 5 menit\n⚠️ Jangan bagikan kode ini kepada siapapun\n\nEmail: ${user.email}\n\n_Jika Anda tidak meminta reset password, abaikan pesan ini._`;

      // Note: Since we're using the bot to send messages to itself (admin),
      // we use the bot's phone number as recipient
      const result = await AimeowClientService.sendMessage({
        clientId: account.clientId,
        to: account.phoneNumber, // Send to the bot's own number (admin will see it)
        message,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Gagal mengirim OTP via WhatsApp',
        };
      }

      // Log to audit
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PASSWORD_RESET_OTP_SENT',
          resource: 'User',
          resourceId: userId,
          details: {
            email: user.email,
            method: 'whatsapp',
            messageId: result.messageId,
          },
          ipAddress: '',
          userAgent: '',
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to send OTP via WhatsApp:', error);
      return {
        success: false,
        error: error.message || 'Internal error',
      };
    }
  }

  /**
   * Save OTP to database
   */
  static async saveOTP(
    userId: string,
    otp: string,
    expiresAt: Date
  ): Promise<void> {
    // Hash OTP before storing
    const hashedOTP = await bcrypt.hash(otp, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: hashedOTP,
        otpExpiry: expiresAt,
        otpAttempts: 0, // Reset attempts
      },
    });
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(
    userId: string,
    otp: string
  ): Promise<{ valid: boolean; error?: string; attemptsLeft?: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        otpCode: true,
        otpExpiry: true,
        otpAttempts: true,
      },
    });

    if (!user || !user.otpCode || !user.otpExpiry) {
      return {
        valid: false,
        error: 'OTP tidak ditemukan. Silakan request OTP baru.',
      };
    }

    // Check if expired
    if (user.otpExpiry < new Date()) {
      return {
        valid: false,
        error: 'OTP sudah kadaluarsa. Silakan request OTP baru.',
      };
    }

    // Check attempts
    if (user.otpAttempts >= 3) {
      return {
        valid: false,
        error: 'Terlalu banyak percobaan gagal. Silakan request OTP baru.',
        attemptsLeft: 0,
      };
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, user.otpCode);

    if (!isValid) {
      // Increment failed attempts
      const newAttempts = user.otpAttempts + 1;
      await prisma.user.update({
        where: { id: userId },
        data: {
          otpAttempts: newAttempts,
        },
      });

      const attemptsLeft = 3 - newAttempts;
      return {
        valid: false,
        error: `Kode OTP salah. Sisa percobaan: ${attemptsLeft}`,
        attemptsLeft,
      };
    }

    // Valid OTP - clear it
    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
      },
    });

    return { valid: true };
  }

  /**
   * Generate password reset token (JWT-like)
   */
  static generateResetToken(userId: string): string {
    const payload = {
      userId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Verify and decode reset token
   */
  static verifyResetToken(token: string): {
    valid: boolean;
    userId?: string;
    error?: string;
  } {
    try {
      const decoded = JSON.parse(
        Buffer.from(token, 'base64').toString('utf-8')
      );

      // Check if token expired (15 minutes)
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - decoded.timestamp > fifteenMinutes) {
        return { valid: false, error: 'Token sudah kadaluarsa' };
      }

      return { valid: true, userId: decoded.userId };
    } catch (error) {
      return { valid: false, error: 'Token tidak valid' };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(
    userId: string,
    newPassword: string,
    tenantId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate password strength
      if (newPassword.length < 8) {
        return {
          success: false,
          error: 'Password minimal 8 karakter',
        };
      }

      // Check for at least one letter and one number
      const hasLetter = /[a-zA-Z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);

      if (!hasLetter || !hasNumber) {
        return {
          success: false,
          error: 'Password harus mengandung huruf dan angka',
        };
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
          otpCode: null,
          otpExpiry: null,
          otpAttempts: 0,
        },
      });

      // Log to audit
      if (tenantId) {
        await prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'PASSWORD_RESET_COMPLETED',
            resource: 'User',
            resourceId: userId,
            details: {
              method: 'whatsapp_otp',
            },
            ipAddress: '',
            userAgent: '',
          },
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      return {
        success: false,
        error: error.message || 'Internal error',
      };
    }
  }

  /**
   * Mask phone number for display
   * Example: 6281234567890 -> 628****7890
   */
  static maskPhoneNumber(phone: string): string {
    if (phone.length <= 7) return phone;
    const start = phone.substring(0, 3);
    const end = phone.substring(phone.length - 4);
    return `${start}****${end}`;
  }
}
