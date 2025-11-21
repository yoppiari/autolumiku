/**
 * Authentication Middleware
 * Verifies JWT tokens and user permissions for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      auditContext?: {
        userId: string;
        tenantId: string;
        ipAddress?: string;
        userAgent?: string;
      };
    }
  }
}

/**
 * Verify JWT token and authenticate user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No valid token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    // Setup audit context
    req.auditContext = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please login again',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token verification failed',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message,
    });
  }
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Super admins have all permissions
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }

    // Check if user has required permissions
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `Required permissions: ${permissions.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient role',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Validate tenant context matches authenticated user
 */
export function validateTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Tenant context required',
    });
  }

  // Super admins can access any tenant
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    return next();
  }

  // Regular users must match tenant context
  if (req.user.tenantId !== tenantId) {
    return res.status(403).json({
      success: false,
      error: 'Tenant access denied',
      message: 'Cannot access data from other tenants',
    });
  }

  next();
}
