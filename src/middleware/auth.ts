/**
 * Authentication Middleware
 * Epic 1: Story 1.1 - User Authentication & Authorization System
 *
 * Next.js compatible middleware for protecting routes and validating JWT tokens.
 * Used in API routes and server components.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  // Support "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return authHeader;
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Validate session is still active
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    // Check if session is revoked or expired
    if (session.revokedAt || session.expiresAt < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session validation failed:', error);
    return false;
  }
}

/**
 * Middleware function to require authentication
 * Use this in API routes that require authentication
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: JWTPayload } | NextResponse> {
  // Extract token
  const token = extractToken(request);

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
        message: 'No authentication token provided',
      },
      { status: 401 }
    );
  }

  // Verify token
  const decoded = verifyToken(token);

  if (!decoded) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired',
      },
      { status: 401 }
    );
  }

  // Validate session
  const isSessionValid = await validateSession(decoded.sessionId);

  if (!isSessionValid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Session expired',
        message: 'Your session has expired. Please login again.',
      },
      { status: 401 }
    );
  }

  // Return user context
  return { user: decoded };
}

/**
 * Middleware function for optional authentication
 * Use this in API routes where auth is optional but provides enhanced features
 */
export async function optionalAuth(request: NextRequest): Promise<{ user: JWTPayload | null }> {
  const token = extractToken(request);

  if (!token) {
    return { user: null };
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return { user: null };
  }

  const isSessionValid = await validateSession(decoded.sessionId);

  if (!isSessionValid) {
    return { user: null };
  }

  return { user: decoded };
}

/**
 * Higher-order function to wrap API route handlers with auth
 * Makes it easy to protect routes without boilerplate
 *
 * Usage:
 * export const GET = withAuth(async (request, { user }) => {
 *   // user is guaranteed to be authenticated here
 *   return NextResponse.json({ userId: user.userId });
 * });
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: { user: JWTPayload }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const authResult = await requireAuth(request);

    // If authResult is a NextResponse, it's an error response
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Call the actual handler with authenticated user
    return handler(request, { user: authResult.user });
  };
}

/**
 * Higher-order function for optional authentication
 *
 * Usage:
 * export const GET = withOptionalAuth(async (request, { user }) => {
 *   // user may be null if not authenticated
 *   if (user) {
 *     return NextResponse.json({ message: 'Welcome back!', userId: user.userId });
 *   }
 *   return NextResponse.json({ message: 'Welcome guest!' });
 * });
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: { user: JWTPayload | null }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const { user } = await optionalAuth(request);
    return handler(request, { user });
  };
}

/**
 * Middleware for checking if user belongs to specific tenant
 * Use this after requireAuth to ensure tenant isolation
 */
export function requireTenant(userTenantId: string, requiredTenantId: string): NextResponse | null {
  if (userTenantId !== requiredTenantId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this tenant',
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Helper to get user from request in server components
 * Not for API routes - use requireAuth or withAuth for those
 */
export async function getUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  const token = extractToken(request);

  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  const isSessionValid = await validateSession(decoded.sessionId);

  if (!isSessionValid) {
    return null;
  }

  return decoded;
}

/**
 * Check if user is authenticated (boolean helper)
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await getUserFromRequest(request);
  return user !== null;
}

/**
 * Rate limiting helper for authentication endpoints
 * Prevents brute force attacks
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  if (!attempt || attempt.resetAt < now) {
    // Create new attempt record
    loginAttempts.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (attempt.count >= maxAttempts) {
    return false;
  }

  // Increment attempt count
  attempt.count++;
  return true;
}

/**
 * Clear rate limit for identifier (after successful login)
 */
export function clearRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}
