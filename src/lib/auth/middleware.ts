/**
 * Authentication Middleware Helpers
 * For protecting API routes and server components
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken, extractTokenFromHeader, type JWTPayload } from './jwt';

import { getRoleLevelFromRole } from '@/lib/rbac';
export { getRoleLevelFromRole };

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    roleLevel: number;
    tenantId: string | null;
  };
  payload?: JWTPayload;
  error?: string;
}

/**
 * Authenticate request and return user data
 * Does NOT send response - returns authentication result
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan login kembali.',
      };
    }

    // Verify JWT token
    const payload = verifyAccessToken(token);
    if (!payload) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan refresh halaman atau login kembali.',
      };
    }

    // Fetch user from database to ensure still exists and active
    // Try with roleLevel first, fallback without if column doesn't exist
    let user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      roleLevel?: number | null;
      tenantId: string | null;
      emailVerified: boolean;
      lockedUntil: Date | null;
    } | null = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          roleLevel: true,
          tenantId: true,
          emailVerified: true,
          lockedUntil: true,
        },
      });
    } catch (err: any) {
      // If roleLevel column doesn't exist (P2022), try without it
      if (err?.code === 'P2022' && err?.meta?.column?.includes('roleLevel')) {
        console.log('[Auth] roleLevel column not found, querying without it');
        user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenantId: true,
            emailVerified: true,
            lockedUntil: true,
          },
        });
      } else {
        throw err;
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        success: false,
        error: 'Account is temporarily locked',
      };
    }

    // Compute roleLevel from role if not set in database
    const roleLevel = user.roleLevel ?? getRoleLevelFromRole(user.role);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roleLevel,
        tenantId: user.tenantId,
      },
      payload,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Middleware wrapper to protect API routes
 * Returns 401 response if authentication fails
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);

  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  return handler(request, auth);
}

/**
 * Middleware wrapper to protect admin-only routes
 * Returns 401 if not authenticated, 403 if not admin
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);

  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user has admin role
  if (!auth.user || !['admin', 'super_admin'].includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  return handler(request, auth);
}

/**
 * Middleware wrapper to protect super admin-only routes
 * Returns 401 if not authenticated, 403 if not super admin
 */
export async function withSuperAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);

  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user has super_admin role
  if (!auth.user || auth.user.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Forbidden - Super admin access required' },
      { status: 403 }
    );
  }

  return handler(request, auth);
}

/**
 * Middleware wrapper to protect platform-level routes (Super Admin & Platform Admin)
 * Allows Super Admin OR (Admin with NO tenantId)
 */
export async function withPlatformAuth(
  request: NextRequest,
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);

  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = auth.user;
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  // PLATFORM ACCESS RULES:
  // 1. Super Admin (Level 110) - always allowed
  // 2. Admin (Level 90) but ONLY if they have NO tenantId (Platform-wide Admin)
  const isSuperAdmin = user.role === 'super_admin';
  const isPlatformAdmin = user.role === 'admin' && !user.tenantId;

  if (!isSuperAdmin && !isPlatformAdmin) {
    return NextResponse.json(
      { error: 'Forbidden - Platform Admin access required' },
      { status: 403 }
    );
  }

  return handler(request, auth);
}

/**
 * Get user permissions based on role
 */
export function getUserPermissions(role: string): string[] {
  switch (role.toLowerCase()) {
    case 'super_admin':
      return [
        'tenant:create', 'tenant:read', 'tenant:update', 'tenant:delete',
        'user:create', 'user:read', 'user:update', 'user:delete',
        'analytics:read', 'audit:read', 'settings:update',
        'scraper:run', 'scraper:read',
      ];
    case 'owner':
      return [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
        'leads:read', 'leads:update',
        'analytics:read',
        'blog:create', 'blog:update', 'blog:delete',
        'catalog:update',
        'settings:update',
      ];
    case 'admin':
      return [
        'user:create', 'user:read', 'user:update',
        'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
        'leads:read', 'leads:update',
        'analytics:read',
        'blog:create', 'blog:update', 'blog:delete',
        'catalog:update',
      ];
    case 'manager':
      return [
        'inventory:read', 'inventory:create', 'inventory:update',
        'leads:read', 'leads:update', 'leads:create',
        'analytics:read',
      ];
    case 'staff':
    case 'sales':
      return [
        'inventory:read', 'inventory:create', 'inventory:update',
        'leads:read', 'leads:create', 'leads:update',
      ];
    default:
      return [];
  }
}
