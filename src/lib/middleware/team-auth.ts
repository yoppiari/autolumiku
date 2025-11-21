import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createLogger } from 'winston';
import { userService } from '@/services/user-service';

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

export interface TeamUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: string;
  permissions: string[];
  teamMemberId?: string;
}

/**
 * JWT utilities for team authentication
 */
class TeamJWT {
  private static readonly SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  private static readonly ALGORITHM = 'HS256';
  private static readonly TOKEN_EXPIRY = '4h';
  private static readonly REFRESH_EXPIRY = '7d';

  static generateTokens(user: TeamUser): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions,
      teamMemberId: user.teamMemberId,
      type: 'team'
    };

    const accessToken = jwt.sign(payload, this.SECRET, {
      algorithm: this.ALGORITHM,
      expiresIn: this.TOKEN_EXPIRY,
      issuer: 'autolumiku',
      audience: 'team-panel'
    });

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        type: 'refresh'
      },
      this.SECRET,
      {
        algorithm: this.ALGORITHM,
        expiresIn: this.REFRESH_EXPIRY,
        issuer: 'autolumiku',
        audience: 'team-panel'
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyToken(token: string): TeamUser {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: [this.ALGORITHM],
        issuer: 'autolumiku',
        audience: 'team-panel'
      }) as any;

      if (decoded.type !== 'team') {
        throw new Error('Invalid token type');
      }

      return {
        id: decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName || '',
        lastName: decoded.lastName || '',
        tenantId: decoded.tenantId,
        role: decoded.role,
        permissions: decoded.permissions || [],
        teamMemberId: decoded.teamMemberId
      };
    } catch (error) {
      logger.error('Team token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  static verifyRefreshToken(token: string): { userId: string; tenantId: string } {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: [this.ALGORITHM],
        issuer: 'autolumiku',
        audience: 'team-panel'
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return {
        userId: decoded.userId,
        tenantId: decoded.tenantId
      };
    } catch (error) {
      logger.error('Team refresh token verification failed:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }
}

/**
 * Team authentication service
 */
class TeamAuthService {
  async authenticate(email: string, password: string, tenantId: string): Promise<any> {
    // Authenticate user using existing user service
    const user = await userService.authenticateUser(email, password);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user belongs to the specified tenant
    if (user.tenantId !== tenantId) {
      throw new Error('Access denied: Invalid tenant');
    }

    // Get team member details if user is a team member
    const teamMember = await this.getTeamMemberByUserId(user.id, tenantId);

    if (!teamMember) {
      throw new Error('User is not a team member');
    }

    if (teamMember.status !== 'active') {
      throw new Error('Team member account is not active');
    }

    const teamUser: TeamUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      role: user.role,
      permissions: teamMember.roles.flatMap((role: any) => role.permissions),
      teamMemberId: teamMember.id
    };

    const tokens = TeamJWT.generateTokens(teamUser);

    logger.info(`Team user authenticated: ${user.email} for tenant: ${tenantId}`);

    return {
      user: teamUser,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async getUserById(userId: string, tenantId: string): Promise<TeamUser | null> {
    try {
      const user = await userService.getUserById(userId);

      if (!user || user.tenantId !== tenantId) {
        return null;
      }

      const teamMember = await this.getTeamMemberByUserId(userId, tenantId);

      if (!teamMember || teamMember.status !== 'active') {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        role: user.role,
        permissions: teamMember.roles.flatMap((role: any) => role.permissions),
        teamMemberId: teamMember.id
      };
    } catch (error) {
      logger.error('Failed to get team user by ID:', error);
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const { userId, tenantId } = TeamJWT.verifyRefreshToken(refreshToken);
    const teamUser = await this.getUserById(userId, tenantId);

    if (!teamUser) {
      throw new Error('User not found or inactive');
    }

    const tokens = TeamJWT.generateTokens(teamUser);
    return tokens.accessToken;
  }

  private async getTeamMemberByUserId(userId: string, tenantId: string): Promise<any> {
    // This would be implemented by the team management service
    // For now, return a mock implementation
    try {
      const { teamManagementService } = await import('@/services/team-management-service');
      return await teamManagementService.getTeamMemberByUserId(userId, tenantId);
    } catch (error) {
      logger.error('Failed to get team member by user ID:', error);
      return null;
    }
  }
}

export const teamAuthService = new TeamAuthService();

/**
 * Middleware to protect team routes
 */
export function withTeamAuth(handler: (req: NextRequest, user: TeamUser) => Promise<Response>) {
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
      const user = TeamJWT.verifyToken(token);

      // Check if user exists and is active
      const teamUser = await teamAuthService.getUserById(user.id, user.tenantId);
      if (!teamUser) {
        return NextResponse.json(
          { error: 'User not found or inactive' },
          { status: 401 }
        );
      }

      // Add tenant context to request headers for downstream services
      const newHeaders = new Headers(req.headers);
      newHeaders.set('x-tenant-id', user.tenantId);
      newHeaders.set('x-user-id', user.id);
      newHeaders.set('x-team-member-id', user.teamMemberId || '');

      // Create new request with modified headers
      const newReq = new Request(req.url, {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        cache: req.cache,
        credentials: req.credentials,
        integrity: req.integrity,
        keepalive: req.keepalive,
        mode: req.mode,
        redirect: req.redirect,
        referrer: req.referrer,
        referrerPolicy: req.referrerPolicy,
        signal: req.signal,
        window: req.window
      });

      // Proceed with the handler
      return handler(newReq, teamUser);
    } catch (error) {
      logger.error('Team auth middleware error:', error);
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }
  };
}

/**
 * Middleware to check specific team permissions
 */
export function requireTeamPermission(permission: string) {
  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return withTeamAuth(async (req: NextRequest, user: TeamUser): Promise<Response> => {
      if (!user.permissions.includes(permission) && !user.permissions.includes('team:admin')) {
        return NextResponse.json(
          {
            error: 'Insufficient permissions',
            required: permission,
            userPermissions: user.permissions
          },
          { status: 403 }
        );
      }

      return handler(req, user);
    });
  };
}

/**
 * Middleware to check specific team roles
 */
export function requireTeamRole(role: string) {
  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return withTeamAuth(async (req: NextRequest, user: TeamUser): Promise<Response> => {
      if (user.role !== role && !user.permissions.includes('team:admin')) {
        return NextResponse.json(
          {
            error: 'Insufficient role access',
            required: role,
            userRole: user.role
          },
          { status: 403 }
        );
      }

      return handler(req, user);
    });
  };
}

/**
 * Middleware to check if user is admin for team operations
 */
export function requireTeamAdmin(handler: (req: NextRequest, user: TeamUser) => Promise<Response>) {
  return withTeamAuth(async (req: NextRequest, user: TeamUser): Promise<Response> => {
    const adminPermissions = ['team:admin', 'team:write', 'team:delete'];
    const hasAdminAccess = adminPermissions.some(perm => user.permissions.includes(perm));

    if (!hasAdminAccess) {
      return NextResponse.json(
        {
          error: 'Team admin access required',
          userPermissions: user.permissions
        },
        { status: 403 }
      );
    }

    return handler(req, user);
  });
}

/**
 * Extract team user from request token (for internal use)
 */
export function extractTeamUser(req: NextRequest): TeamUser | null {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    return TeamJWT.verifyToken(token);
  } catch (error) {
    logger.debug('Failed to extract team user:', error);
    return null;
  }
}

/**
 * Rate limiting middleware for team API endpoints
 */
export function withTeamRateLimit(limit: number = 100, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return withTeamAuth(async (req: NextRequest, user: TeamUser): Promise<Response> => {
      const key = `${user.tenantId}:${user.id}`;
      const now = Date.now();

      // Clean up expired entries
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < now) {
          requests.delete(k);
        }
      }

      // Check current rate limit
      const current = requests.get(key);
      if (current && current.count >= limit && current.resetTime > now) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            limit,
            windowMs,
            resetTime: current.resetTime
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': current.resetTime.toString()
            }
          }
        );
      }

      // Update request count
      if (current) {
        current.count++;
      } else {
        requests.set(key, {
          count: 1,
          resetTime: now + windowMs
        });
      }

      // Add rate limit headers
      const response = await handler(req, user);

      // Add rate limit headers to response
      if (response instanceof Response) {
        response.headers.set('X-RateLimit-Limit', limit.toString());
        const remaining = Math.max(0, limit - (requests.get(key)?.count || 0));
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', (requests.get(key)?.resetTime || 0).toString());
      }

      return response;
    });
  };
}