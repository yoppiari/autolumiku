import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
}

export interface AdminAuthResult {
  user: AdminUser;
  token: string;
}

/**
 * JWT utilities for admin authentication
 */
class AdminJWT {
  private static readonly SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  private static readonly ALGORITHM = 'HS256';
  private static readonly TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_EXPIRY = '7d';

  static generateTokens(user: AdminUser): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      type: 'admin'
    };

    const accessToken = jwt.sign(payload, this.SECRET, {
      algorithm: this.ALGORITHM,
      expiresIn: this.TOKEN_EXPIRY,
      issuer: 'autolumiku',
      audience: 'admin-panel'
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      this.SECRET,
      {
        algorithm: this.ALGORITHM,
        expiresIn: this.REFRESH_EXPIRY,
        issuer: 'autolumiku',
        audience: 'admin-panel'
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyToken(token: string): AdminUser {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: [this.ALGORITHM],
        issuer: 'autolumiku',
        audience: 'admin-panel'
      }) as any;

      if (decoded.type !== 'admin') {
        throw new Error('Invalid token type');
      }

      return {
        id: decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName || '',
        lastName: decoded.lastName || '',
        role: decoded.role,
        permissions: decoded.permissions || []
      };
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  static verifyRefreshToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: [this.ALGORITHM],
        issuer: 'autolumiku',
        audience: 'admin-panel'
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return { userId: decoded.userId };
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }
}

/**
 * Mock admin user database for demonstration
 * In production, this would query a real database
 */
const mockAdminUsers: AdminUser[] = [
  {
    id: 'admin-1',
    email: 'admin@autolumiku.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    permissions: ['tenants:read', 'tenants:write', 'tenants:delete', 'system:admin']
  }
];

/**
 * Admin authentication service
 */
class AdminAuthService {
  async authenticate(email: string, password: string): Promise<AdminAuthResult> {
    // Mock authentication - in production, verify against database
    const adminUser = mockAdminUsers.find(user => user.email === email);

    if (!adminUser) {
      throw new Error('Invalid credentials');
    }

    // Mock password verification - in production, use bcrypt
    const isValidPassword = password === 'admin123'; // Mock password

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = AdminJWT.generateTokens(adminUser);

    logger.info(`Admin user authenticated: ${adminUser.email}`);

    return {
      user: adminUser,
      token: tokens.accessToken
    };
  }

  async getUserById(userId: string): Promise<AdminUser | null> {
    return mockAdminUsers.find(user => user.id === userId) || null;
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const { userId } = AdminJWT.verifyRefreshToken(refreshToken);
    const adminUser = await this.getUserById(userId);

    if (!adminUser) {
      throw new Error('User not found');
    }

    const tokens = AdminJWT.generateTokens(adminUser);
    return tokens.accessToken;
  }
}

export const adminAuthService = new AdminAuthService();

/**
 * Middleware to protect admin routes
 */
export function withAdminAuth(handler: (req: NextRequest, user: AdminUser) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Verify token and extract user
      const user = AdminJWT.verifyToken(token);

      // Check if user exists and is active
      const adminUser = await adminAuthService.getUserById(user.id);
      if (!adminUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        );
      }

      // Proceed with the handler
      return handler(req, adminUser);
    } catch (error) {
      logger.error('Admin auth middleware error:', error);
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }
  };
}

/**
 * Middleware to check specific permissions
 */
export function requirePermission(permission: string) {
  return (handler: (req: NextRequest, user: AdminUser) => Promise<Response>) => {
    return withAdminAuth(async (req: NextRequest, user: AdminUser): Promise<Response> => {
      if (!user.permissions.includes(permission)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      return handler(req, user);
    });
  };
}

/**
 * Middleware to check user role
 */
export function requireRole(role: 'admin' | 'super_admin') {
  return (handler: (req: NextRequest, user: AdminUser) => Promise<Response>) => {
    return withAdminAuth(async (req: NextRequest, user: AdminUser): Promise<Response> => {
      if (role === 'super_admin' && user.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Super admin access required' },
          { status: 403 }
        );
      }

      return handler(req, user);
    });
  };
}

/**
 * Extract user from request token (for internal use)
 */
export function extractAdminUser(req: NextRequest): AdminUser | null {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    return AdminJWT.verifyToken(token);
  } catch (error) {
    logger.debug('Failed to extract admin user:', error);
    return null;
  }
}