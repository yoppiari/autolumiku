/**
 * Authentication & Password Reset Types
 */

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  method: 'whatsapp' | 'email' | 'unavailable';
  message: string;
  phoneNumber?: string; // Masked phone number (e.g., "628****1234")
  error?: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  resetToken?: string;
  expiresIn?: number; // seconds
  message?: string;
  error?: string;
  attemptsLeft?: number;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface OTPGenerationResult {
  otp: string;
  expiresAt: Date;
}

export interface RateLimitCheck {
  allowed: boolean;
  remainingAttempts?: number;
  resetAt?: Date;
  message?: string;
}

export interface WhatsAppResetEligibility {
  eligible: boolean;
  reason?: string;
  tenantId?: string;
  whatsappConnected?: boolean;
}
