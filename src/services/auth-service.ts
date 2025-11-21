/**
 * Authentication Service
 * Epic 1: Story 1.1 - User Authentication & Authorization System
 *
 * Handles user registration, login, token management, password reset,
 * and email verification for the AutoLumiKu platform.
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Session } from '@prisma/client';
import crypto from 'crypto';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15');

/**
 * Authentication response with tokens and user data
 */
export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    role: string;
    isEmailVerified: boolean;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message?: string;
  requiresVerification?: boolean;
}

/**
 * Registration request data
 */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId?: string; // Optional for new tenant signup
  roleId?: string; // Optional for invited users
}

/**
 * Login request data
 */
export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    deviceType: string;
  };
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        return {
          success: false,
          message: 'Email already registered',
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date();
      verificationExpiry.setHours(verificationExpiry.getHours() + 24); // 24 hours

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          tenantId: data.tenantId || '',
          role: data.roleId || 'user',
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
          emailVerified: false,
          failedLoginAttempts: 0,
        },
      });

      // Log security event
      await this.logSecurityEvent(user.id, user.tenantId, 'user_registered', {
        email: data.email,
        tenantId: data.tenantId,
      });

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(user.email, verificationToken);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: user.tenantId,
          role: user.role,
          isEmailVerified: user.emailVerified,
        },
        message: 'Registration successful. Please verify your email.',
        requiresVerification: true,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.',
      };
    }
  }

  /**
   * Login user and create session
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - new Date().getTime()) / 60000
        );
        return {
          success: false,
          message: `Account locked. Try again in ${remainingMinutes} minutes.`,
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);

      if (!isValidPassword) {
        // Increment failed login attempts
        const failedAttempts = user.failedLoginAttempts + 1;
        const updateData: any = {
          failedLoginAttempts: failedAttempts,
        };

        // Lock account if max attempts reached
        if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
          updateData.lockedUntil = lockUntil;

          await this.logSecurityEvent(user.id, user.tenantId, 'account_locked', {
            failedAttempts,
            lockUntil: lockUntil.toISOString(),
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        await this.logSecurityEvent(user.id, user.tenantId, 'failed_login', {
          email: data.email,
          failedAttempts,
        });

        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Check if email is verified (optional enforcement)
      if (!user.emailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
        return {
          success: false,
          message: 'Please verify your email before logging in.',
          requiresVerification: true,
        };
      }

      // Reset failed login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      // Generate a temporary session ID for token generation
      const tempSessionId = crypto.randomUUID();

      // Generate tokens
      const accessToken = this.generateAccessToken(user, tempSessionId);
      const refreshToken = this.generateRefreshToken(user, tempSessionId);

      // Create session with tokens
      const session = await prisma.session.create({
        data: {
          id: tempSessionId,
          userId: user.id,
          tenantId: user.tenantId,
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress: data.deviceInfo?.ipAddress || '',
          deviceType: data.deviceInfo?.deviceType || 'unknown',
        },
      });

      // Log successful login
      await this.logSecurityEvent(user.id, user.tenantId, 'user_login', {
        sessionId: session.id,
        ipAddress: data.deviceInfo?.ipAddress,
        userAgent: data.deviceInfo?.userAgent,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: user.tenantId,
          role: user.role || 'user',
          isEmailVerified: user.emailVerified,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: this.getTokenExpiry(JWT_EXPIRY),
        },
        message: 'Login successful',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerificationExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token',
        };
      }

      // Mark email as verified
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });

      await this.logSecurityEvent(user.id, user.tenantId, 'email_verified', {
        email: user.email,
      });

      return {
        success: true,
        message: 'Email verified successfully',
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'Email verification failed',
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists
        return {
          success: true,
          message: 'If the email exists, a reset link has been sent.',
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date();
      resetExpiry.setHours(resetExpiry.getHours() + 1); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry,
        },
      });

      await this.logSecurityEvent(user.id, user.tenantId, 'password_reset_requested', {
        email: user.email,
      });

      // TODO: Send reset email
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      return {
        success: true,
        message: 'If the email exists, a reset link has been sent.',
      };
    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        message: 'Password reset request failed',
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: PasswordResetRequest): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: data.token,
          passwordResetExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset token',
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(data.newPassword, 12);

      // Update password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });

      // Revoke all existing sessions for security
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });

      await this.logSecurityEvent(user.id, user.tenantId, 'password_reset_completed', {
        email: user.email,
      });

      return {
        success: true,
        message: 'Password reset successful. Please login with your new password.',
      };
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        message: 'Password reset failed',
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;

      if (decoded.type !== 'refresh') {
        return {
          success: false,
          message: 'Invalid token type',
        };
      }

      // Verify session is still valid
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return {
          success: false,
          message: 'Session expired or revoked',
        };
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(session.user, session.id);

      return {
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: refreshToken, // Keep same refresh token
          expiresIn: this.getTokenExpiry(JWT_EXPIRY),
        },
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        message: 'Token refresh failed',
      };
    }
  }

  /**
   * Logout user and revoke session
   */
  async logout(sessionId: string): Promise<AuthResponse> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Logout failed',
      };
    }
  }

  /**
   * Generate access token (JWT)
   */
  private generateAccessToken(user: User, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
      type: 'access',
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }

  /**
   * Generate refresh token (JWT)
   */
  private generateRefreshToken(user: User, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
      type: 'refresh',
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  }

  /**
   * Get token expiry in seconds
   */
  private getTokenExpiry(expiry: string): number {
    const match = expiry.match(/(\d+)([hmd])/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      case 'm':
        return value * 60;
      default:
        return 3600;
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    userId: string,
    tenantId: string,
    eventType: string,
    metadata: any
  ): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId,
          tenantId,
          eventType,
          severity: this.getEventSeverity(eventType),
          ipAddress: metadata.ipAddress || '',
          userAgent: metadata.userAgent || '',
          details: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get event severity level
   */
  private getEventSeverity(eventType: string): string {
    const highSeverity = ['account_locked', 'password_reset_completed'];
    const mediumSeverity = ['failed_login', 'password_reset_requested'];

    if (highSeverity.includes(eventType)) return 'high';
    if (mediumSeverity.includes(eventType)) return 'medium';
    return 'low';
  }
}

export const authService = new AuthService();
