/**
 * Authentication Service
 * Handles user registration, login, and authentication
 * Part of Story 1.7: User Account Creation & Authentication
 */

import bcrypt from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { createLogger, format, transports } from 'winston';
import { z } from 'zod';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/auth-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/auth-combined.log' })
  ]
});

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId: string;
  role: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId: string;
  role?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().regex(/^(\+62|62|0)[0-9]{9,12}$/, 'Invalid Indonesian phone number').optional(),
  tenantId: z.string().uuid('Invalid tenant ID')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

  // In-memory storage (replace with database in production)
  private users: Map<string, User> = new Map();
  private emailToUserId: Map<string, string> = new Map();

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || (() => {
      throw new Error('JWT_SECRET must be configured');
    })();
  }

  /**
   * Register new user
   */
  async register(data: RegisterUserData): Promise<{ user: Omit<User, 'passwordHash'>; verificationToken: string }> {
    try {
      // Validate input
      const validated = registerSchema.parse(data);

      // Check if email already exists
      if (this.emailToUserId.has(validated.email.toLowerCase())) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validated.password, this.SALT_ROUNDS);

      // Generate email verification token
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpiry = new Date(Date.now() + this.EMAIL_VERIFICATION_EXPIRY);

      // Create user
      const user: User = {
        id: `user_${Date.now()}_${randomBytes(8).toString('hex')}`,
        email: validated.email.toLowerCase(),
        passwordHash,
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone,
        tenantId: validated.tenantId,
        role: data.role || 'user',
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpiry,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.users.set(user.id, user);
      this.emailToUserId.set(user.email, user.id);

      logger.info(`User registered: ${user.email}`);

      // Return user without sensitive data
      const { passwordHash: _, emailVerificationToken: token, ...safeUser } = user;

      return {
        user: safeUser,
        verificationToken: token!
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // Find user by verification token
      const user = Array.from(this.users.values()).find(
        u => u.emailVerificationToken === token
      );

      if (!user) {
        throw new Error('Invalid verification token');
      }

      if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
        throw new Error('Verification token expired');
      }

      // Mark email as verified
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpiry = undefined;
      user.updatedAt = new Date();

      logger.info(`Email verified for user: ${user.email}`);

      return true;
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification(email: string): Promise<string> {
    try {
      const userId = this.emailToUserId.get(email.toLowerCase());
      if (!userId) {
        throw new Error('User not found');
      }

      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.emailVerified) {
        throw new Error('Email already verified');
      }

      // Generate new token
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpiry = new Date(Date.now() + this.EMAIL_VERIFICATION_EXPIRY);

      user.emailVerificationToken = emailVerificationToken;
      user.emailVerificationExpiry = emailVerificationExpiry;
      user.updatedAt = new Date();

      logger.info(`Verification email resent for: ${user.email}`);

      return emailVerificationToken;
    } catch (error) {
      logger.error('Resend verification error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens & { user: Omit<User, 'passwordHash'> }> {
    try {
      // Validate input
      const validated = loginSchema.parse(credentials);

      const userId = this.emailToUserId.get(validated.email.toLowerCase());
      if (!userId) {
        throw new Error('Invalid credentials');
      }

      const user = this.users.get(userId);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw new Error(`Account locked. Try again in ${remainingTime} minutes`);
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new Error('Email not verified. Please check your inbox');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(validated.password, user.passwordHash);

      if (!isPasswordValid) {
        // Increment failed login attempts
        user.failedLoginAttempts += 1;

        if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
          user.lockedUntil = new Date(Date.now() + this.LOCK_DURATION);
          logger.warn(`Account locked due to failed login attempts: ${user.email}`);
          throw new Error('Account locked due to too many failed login attempts');
        }

        user.updatedAt = new Date();
        throw new Error('Invalid credentials');
      }

      // Reset failed login attempts on successful login
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();

      // Generate auth tokens
      const tokens = await this.generateAuthTokens(user);

      logger.info(`User logged in: ${user.email}`);

      const { passwordHash: _, ...safeUser } = user;

      return {
        ...tokens,
        user: safeUser
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const userId = this.emailToUserId.get(email.toLowerCase());
      if (!userId) {
        // Don't reveal if email exists
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        return 'dummy_token'; // Return dummy token to prevent email enumeration
      }

      const user = this.users.get(userId);
      if (!user) {
        return 'dummy_token';
      }

      // Generate reset token
      const passwordResetToken = randomBytes(32).toString('hex');
      const passwordResetExpiry = new Date(Date.now() + this.PASSWORD_RESET_EXPIRY);

      user.passwordResetToken = passwordResetToken;
      user.passwordResetExpiry = passwordResetExpiry;
      user.updatedAt = new Date();

      logger.info(`Password reset requested for: ${user.email}`);

      return passwordResetToken;
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Validate password
      registerSchema.shape.password.parse(newPassword);

      // Find user by reset token
      const user = Array.from(this.users.values()).find(
        u => u.passwordResetToken === token
      );

      if (!user) {
        throw new Error('Invalid reset token');
      }

      if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
        throw new Error('Reset token expired');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update user
      user.passwordHash = passwordHash;
      user.passwordResetToken = undefined;
      user.passwordResetExpiry = undefined;
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.updatedAt = new Date();

      logger.info(`Password reset for user: ${user.email}`);

      return true;
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Validate new password
      registerSchema.shape.password.parse(newPassword);

      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Check if new password is same as current
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      user.passwordHash = passwordHash;
      user.updatedAt = new Date();

      logger.info(`Password changed for user: ${user.email}`);

      return true;
    } catch (error) {
      logger.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateAuthTokens(user: User): Promise<AuthTokens> {
    const accessTokenExpiry = 15 * 60; // 15 minutes
    const refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days

    const accessToken = sign(
      {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role
      },
      this.JWT_SECRET,
      { expiresIn: accessTokenExpiry }
    );

    const refreshToken = sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      this.JWT_SECRET,
      { expiresIn: refreshTokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + accessTokenExpiry * 1000)
    };
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<any> {
    try {
      return verify(token, this.JWT_SECRET);
    } catch (error) {
      logger.error('Token verification error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<Omit<User, 'passwordHash'> | null> {
    const userId = this.emailToUserId.get(email.toLowerCase());
    if (!userId) {
      return null;
    }

    return this.getUserById(userId);
  }
}

// Singleton instance
export const authService = new AuthService();
