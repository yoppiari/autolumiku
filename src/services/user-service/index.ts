import { createLogger } from 'winston';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const logger = createLogger({
  level: 'info',
  format: {
    combine: [
      require('winston').format.timestamp(),
      require('winston').format.errors({ stack: true }),
      require('winston').format.json(),
    ],
  },
  transports: [
    new require('winston').transports.Console({
      format: require('winston').format.combine(
        require('winston').format.colorize(),
        require('winston').format.simple()
      )
    })
  ]
});

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'tenant_admin' | 'user';
  tenantId?: string;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: User['role'];
  tenantId?: string;
  password?: string;
  sendWelcomeEmail?: boolean;
}

export interface UserLoginRequest {
  email: string;
  password: string;
  tenantId?: string; // For tenant-specific login
}

export interface UserLoginResponse {
  user: Omit<User, 'password'>;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * User management service
 */
export class UserService {
  private users: Map<string, User> = new Map();
  private userPasswords: Map<string, string> = new Map();

  /**
   * Create new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    logger.info(`Creating new user: ${request.email}`);

    try {
      // Validate email uniqueness
      if (this.getUserByEmail(request.email)) {
        throw new Error(`User with email ${request.email} already exists`);
      }

      // Generate password if not provided
      const password = request.password || this.generateSecurePassword();
      const hashedPassword = await bcrypt.hash(password, 12);

      const user: User = {
        id: nanoid(),
        email: request.email.toLowerCase(),
        firstName: request.firstName.trim(),
        lastName: request.lastName.trim(),
        phone: request.phone?.trim(),
        role: request.role,
        tenantId: request.tenantId,
        status: 'active',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store user and password
      this.users.set(user.id, user);
      this.userPasswords.set(user.id, hashedPassword);

      // Send welcome email if requested
      if (request.sendWelcomeEmail) {
        await this.sendWelcomeEmail(user, password);
      }

      logger.info(`User created successfully: ${user.id}`);
      return user;

    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Create tenant admin user
   */
  async createTenantAdminUser(
    tenantId: string,
    email: string,
    firstName: string,
    lastName: string,
    phone?: string
  ): Promise<{ user: User; temporaryPassword: string }> {
    logger.info(`Creating tenant admin user for tenant: ${tenantId}`);

    try {
      const temporaryPassword = this.generateSecurePassword();

      const user = await this.createUser({
        email,
        firstName,
        lastName,
        phone,
        role: 'tenant_admin',
        tenantId,
        password: temporaryPassword,
        sendWelcomeEmail: true
      });

      return {
        user,
        temporaryPassword
      };

    } catch (error) {
      logger.error('Failed to create tenant admin user:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async loginUser(request: UserLoginRequest): Promise<UserLoginResponse> {
    logger.info(`Login attempt: ${request.email}`);

    try {
      // Find user by email
      const user = this.getUserByEmail(request.email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check tenant-specific login if tenantId provided
      if (request.tenantId && user.tenantId !== request.tenantId) {
        throw new Error('User does not belong to this tenant');
      }

      // Check user status
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Get stored password
      const storedPassword = this.userPasswords.get(user.id);
      if (!storedPassword) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(request.password, storedPassword);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user.id);

      // Update last login
      user.lastLogin = new Date();
      user.updatedAt = new Date();

      logger.info(`User logged in successfully: ${user.id}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          tenantId: user.tenantId,
          status: user.status,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token,
        refreshToken,
        expiresIn: 24 * 60 * 60 // 24 hours
      };

    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Refresh user token
   */
  async refreshToken(refreshToken: string): Promise<UserLoginResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };

      const user = this.users.get(decoded.userId);
      if (!user) {
        throw new Error('Invalid refresh token');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Generate new tokens
      const token = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          tenantId: user.tenantId,
          status: user.status,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token,
        refreshToken: newRefreshToken,
        expiresIn: 24 * 60 * 60
      };

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Send welcome email
   */
  private async sendWelcomeEmail(user: User, temporaryPassword: string): Promise<void> {
    logger.info(`Sending welcome email to: ${user.email}`);

    // This is a placeholder - in production, integrate with email service
    const emailContent = {
      to: user.email,
      subject: 'Welcome to autolumiku!',
      body: `
        Dear ${user.firstName} ${user.lastName},

        Welcome to autolumiku! Your account has been created successfully.

        Login Details:
        Email: ${user.email}
        Temporary Password: ${temporaryPassword}

        Please log in and change your password immediately.

        Best regards,
        autolumiku Team
      `
    };

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info(`Welcome email sent to: ${user.email}`);
  }

  /**
   * Generate secure random password
   */
  private generateSecurePassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Get user by email
   */
  private getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(
      user => user.email === email.toLowerCase()
    );
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  /**
   * Get users by tenant
   */
  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      user => user.tenantId === tenantId
    );
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<CreateUserRequest>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const storedPassword = this.userPasswords.get(userId);
    if (!storedPassword) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, storedPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    this.userPasswords.set(userId, hashedNewPassword);
  }

  /**
   * Reset user password
   */
  async resetPassword(userId: string): Promise<string> {
    const newPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    this.userPasswords.set(userId, hashedPassword);

    // Send password reset email
    const user = this.users.get(userId);
    if (user) {
      await this.sendPasswordResetEmail(user, newPassword);
    }

    return newPassword;
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(user: User, newPassword: string): Promise<void> {
    logger.info(`Sending password reset email to: ${user.email}`);

    // This is a placeholder - in production, integrate with email service
    const emailContent = {
      to: user.email,
      subject: 'Your Password Has Been Reset',
      body: `
        Dear ${user.firstName} ${user.lastName},

        Your password has been reset successfully.

        New Password: ${newPassword}

        Please log in and change your password immediately.

        Best regards,
        autolumiku Team
      `
    };

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info(`Password reset email sent to: ${user.email}`);
  }
}

export const userService = new UserService();