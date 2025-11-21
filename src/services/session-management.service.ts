import { createLogger, format, transports } from 'winston';
import Redis from 'ioredis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import UAParser from 'ua-parser-js';

const logger = createLogger({
  level: 'info',
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
    })
  ]
});

/**
 * Session data structure stored in Redis
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  permissions: string[];
  device: DeviceInfo;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  refreshTokenId: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    city: string;
  };
  isActive: boolean;
  loginAttempts?: number;
  suspiciousActivity?: SuspiciousActivity[];
}

/**
 * Device information for fingerprinting
 */
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  fingerprint: string;
}

/**
 * Suspicious activity tracking
 */
export interface SuspiciousActivity {
  timestamp: Date;
  type: 'multiple_failed_login' | 'unusual_location' | 'device_change' | 'rapid_requests' | 'session_hijack_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  ipAddress: string;
}

/**
 * Refresh token data
 */
export interface RefreshTokenData {
  tokenId: string;
  userId: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  deviceId: string;
  isRevoked: boolean;
  previousTokenId?: string;
}

/**
 * Session configuration for Indonesian mobile networks
 */
export interface SessionConfig {
  accessTokenExpiry: string; // e.g., '4h'
  refreshTokenExpiry: string; // e.g., '7d'
  sessionTimeout: number; // milliseconds of inactivity before session expires
  maxFailedAttempts: number;
  lockoutDuration: number; // milliseconds
  maxDevicesPerUser: number;
  enableOfflineMode: boolean;
  networkOptimization: {
    enableCompression: boolean;
    reducedPayload: boolean;
    cachingStrategy: 'aggressive' | 'moderate' | 'minimal';
  };
}

/**
 * Default configuration optimized for Indonesian networks
 */
const DEFAULT_CONFIG: SessionConfig = {
  accessTokenExpiry: '4h',
  refreshTokenExpiry: '7d',
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  maxDevicesPerUser: 5,
  enableOfflineMode: true,
  networkOptimization: {
    enableCompression: true,
    reducedPayload: true,
    cachingStrategy: 'aggressive'
  }
};

/**
 * Comprehensive Session Management Service
 * Story 1.9: Secure Session Management
 */
export class SessionManagementService {
  private redis: Redis;
  private config: SessionConfig;
  private readonly JWT_SECRET: string;
  private readonly JWT_ALGORITHM = 'HS256';

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // JWT_SECRET must be configured - no fallback for security
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required for session management. Please configure it in your environment.');
    }
    this.JWT_SECRET = process.env.JWT_SECRET;

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: this.config.enableOfflineMode
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully for session management');
    });
  }

  /**
   * Create a new session with JWT tokens
   */
  async createSession(
    userId: string,
    tenantId: string,
    email: string,
    role: string,
    permissions: string[],
    request: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      // Check if user has too many active sessions
      const activeSessions = await this.getUserActiveSessions(userId);
      if (activeSessions.length >= this.config.maxDevicesPerUser) {
        // Remove oldest session
        const oldestSession = activeSessions.sort(
          (a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
        )[0];
        await this.revokeSession(oldestSession.sessionId);
        logger.info(`Removed oldest session for user ${userId} due to device limit`);
      }

      // Generate device fingerprint
      const device = this.generateDeviceInfo(request.userAgent, request.ipAddress);

      // Generate unique session ID
      const sessionId = `sess_${crypto.randomBytes(32).toString('hex')}`;

      // Generate refresh token ID
      const refreshTokenId = `refresh_${crypto.randomBytes(32).toString('hex')}`;

      // Calculate expiry times
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.parseExpiry(this.config.accessTokenExpiry));

      // Create session data
      const sessionData: SessionData = {
        sessionId,
        userId,
        tenantId,
        email,
        role,
        permissions,
        device,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        refreshTokenId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        isActive: true
      };

      // Store session in Redis with TTL
      const sessionKey = `session:${sessionId}`;
      await this.redis.setex(
        sessionKey,
        Math.floor(this.parseExpiry(this.config.accessTokenExpiry) / 1000),
        JSON.stringify(sessionData)
      );

      // Track user's active sessions
      await this.redis.sadd(`user_sessions:${userId}`, sessionId);

      // Generate JWT tokens
      const accessToken = this.generateAccessToken(sessionData);
      const refreshToken = this.generateRefreshToken(
        userId,
        sessionId,
        refreshTokenId,
        device.deviceId
      );

      // Store refresh token
      await this.storeRefreshToken(refreshToken, userId, sessionId, refreshTokenId, device.deviceId);

      logger.info(`Session created for user ${userId} from device ${device.deviceName}`);

      return {
        sessionId,
        accessToken,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      // Verify and decode refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET, {
        algorithms: [this.JWT_ALGORITHM],
        issuer: 'autolumiku',
        audience: 'refresh'
      }) as any;

      const { userId, sessionId, tokenId, deviceId } = decoded;

      // Check if refresh token is revoked
      const tokenKey = `refresh_token:${tokenId}`;
      const tokenData = await this.redis.get(tokenKey);

      if (!tokenData) {
        throw new Error('Refresh token not found or expired');
      }

      const tokenInfo: RefreshTokenData = JSON.parse(tokenData);

      if (tokenInfo.isRevoked) {
        throw new Error('Refresh token has been revoked');
      }

      // Get current session
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        throw new Error('Session not found or expired');
      }

      const session: SessionData = JSON.parse(sessionData);

      // Update session activity
      session.lastActivity = new Date();
      session.expiresAt = new Date(Date.now() + this.parseExpiry(this.config.accessTokenExpiry));

      // Store updated session
      await this.redis.setex(
        sessionKey,
        Math.floor(this.parseExpiry(this.config.accessTokenExpiry) / 1000),
        JSON.stringify(session)
      );

      // Rotate refresh token (security best practice)
      const newRefreshTokenId = `refresh_${crypto.randomBytes(32).toString('hex')}`;
      const newRefreshToken = this.generateRefreshToken(
        userId,
        sessionId,
        newRefreshTokenId,
        deviceId,
        tokenId // Link to previous token for audit
      );

      // Revoke old refresh token
      tokenInfo.isRevoked = true;
      await this.redis.setex(
        tokenKey,
        60 * 60, // Keep for 1 hour for audit purposes
        JSON.stringify(tokenInfo)
      );

      // Store new refresh token
      await this.storeRefreshToken(newRefreshToken, userId, sessionId, newRefreshTokenId, deviceId);

      // Generate new access token
      const accessToken = this.generateAccessToken(session);

      logger.info(`Session refreshed for user ${userId}`);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      throw new Error('Session refresh failed');
    }
  }

  /**
   * Verify and get session from access token
   */
  async verifySession(accessToken: string): Promise<SessionData | null> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(accessToken, this.JWT_SECRET, {
        algorithms: [this.JWT_ALGORITHM],
        issuer: 'autolumiku',
        audience: 'access'
      }) as any;

      const { sessionId } = decoded;

      // Get session from Redis
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      const session: SessionData = JSON.parse(sessionData);

      // Check if session is active
      if (!session.isActive) {
        return null;
      }

      // Check if session has expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.revokeSession(sessionId);
        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      await this.redis.setex(
        sessionKey,
        Math.floor(this.parseExpiry(this.config.accessTokenExpiry) / 1000),
        JSON.stringify(session)
      );

      return session;
    } catch (error) {
      logger.debug('Session verification failed:', error);
      return null;
    }
  }

  /**
   * Revoke a session (logout)
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (sessionData) {
        const session: SessionData = JSON.parse(sessionData);

        // Mark session as inactive
        session.isActive = false;
        await this.redis.setex(
          sessionKey,
          300, // Keep for 5 minutes for audit
          JSON.stringify(session)
        );

        // Remove from user's active sessions
        await this.redis.srem(`user_sessions:${session.userId}`, sessionId);

        // Revoke associated refresh token
        const refreshTokenKey = `refresh_token:${session.refreshTokenId}`;
        const refreshTokenData = await this.redis.get(refreshTokenKey);
        if (refreshTokenData) {
          const tokenInfo: RefreshTokenData = JSON.parse(refreshTokenData);
          tokenInfo.isRevoked = true;
          await this.redis.setex(refreshTokenKey, 300, JSON.stringify(tokenInfo));
        }

        logger.info(`Session revoked: ${sessionId} for user ${session.userId}`);
      }
    } catch (error) {
      logger.error('Failed to revoke session:', error);
      throw new Error('Session revocation failed');
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);

      for (const sessionId of sessionIds) {
        await this.revokeSession(sessionId);
      }

      await this.redis.del(`user_sessions:${userId}`);

      logger.info(`All sessions revoked for user ${userId}`);
    } catch (error) {
      logger.error('Failed to revoke all user sessions:', error);
      throw new Error('Failed to revoke all sessions');
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.redis.get(sessionKey);

        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          if (session.isActive && new Date(session.expiresAt) > new Date()) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to get user active sessions:', error);
      return [];
    }
  }

  /**
   * Track failed login attempt
   */
  async trackFailedLogin(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ locked: boolean; attemptsRemaining: number }> {
    try {
      const lockoutKey = `lockout:${userId}`;
      const attemptsKey = `login_attempts:${userId}`;

      // Check if user is already locked out
      const lockout = await this.redis.get(lockoutKey);
      if (lockout) {
        return { locked: true, attemptsRemaining: 0 };
      }

      // Increment failed attempts
      const attempts = await this.redis.incr(attemptsKey);

      // Set expiry for attempts counter (1 hour)
      if (attempts === 1) {
        await this.redis.expire(attemptsKey, 3600);
      }

      // Check if lockout threshold reached
      if (attempts >= this.config.maxFailedAttempts) {
        // Lock the account
        await this.redis.setex(
          lockoutKey,
          Math.floor(this.config.lockoutDuration / 1000),
          JSON.stringify({
            lockedAt: new Date(),
            attempts,
            ipAddress,
            userAgent
          })
        );

        // Log suspicious activity
        await this.logSuspiciousActivity(userId, {
          timestamp: new Date(),
          type: 'multiple_failed_login',
          severity: 'high',
          details: `Account locked after ${attempts} failed attempts`,
          ipAddress
        });

        logger.warn(`User ${userId} locked out after ${attempts} failed attempts`);

        return { locked: true, attemptsRemaining: 0 };
      }

      const attemptsRemaining = this.config.maxFailedAttempts - attempts;
      logger.info(`Failed login attempt for user ${userId}. ${attemptsRemaining} attempts remaining`);

      return { locked: false, attemptsRemaining };
    } catch (error) {
      logger.error('Failed to track failed login:', error);
      throw error;
    }
  }

  /**
   * Clear failed login attempts (after successful login)
   */
  async clearFailedAttempts(userId: string): Promise<void> {
    try {
      await this.redis.del(`login_attempts:${userId}`);
      logger.info(`Cleared failed login attempts for user ${userId}`);
    } catch (error) {
      logger.error('Failed to clear failed attempts:', error);
    }
  }

  /**
   * Check if user is locked out
   */
  async isUserLockedOut(userId: string): Promise<boolean> {
    try {
      const lockoutKey = `lockout:${userId}`;
      const lockout = await this.redis.get(lockoutKey);
      return lockout !== null;
    } catch (error) {
      logger.error('Failed to check user lockout status:', error);
      return false;
    }
  }

  /**
   * Log suspicious activity
   */
  private async logSuspiciousActivity(
    userId: string,
    activity: SuspiciousActivity
  ): Promise<void> {
    try {
      const key = `suspicious_activity:${userId}`;
      await this.redis.lpush(key, JSON.stringify(activity));
      await this.redis.ltrim(key, 0, 99); // Keep last 100 activities
      await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 days

      logger.warn(`Suspicious activity logged for user ${userId}:`, activity);
    } catch (error) {
      logger.error('Failed to log suspicious activity:', error);
    }
  }

  /**
   * Generate device info and fingerprint
   */
  private generateDeviceInfo(userAgent: string, ipAddress: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const deviceType = result.device.type || 'desktop';
    const browser = result.browser.name || 'Unknown';
    const browserVersion = result.browser.version || '';
    const os = result.os.name || 'Unknown';
    const osVersion = result.os.version || '';

    // Generate device fingerprint
    const fingerprintData = `${browser}:${browserVersion}:${os}:${osVersion}:${ipAddress}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex')
      .substring(0, 16);

    const deviceId = `device_${fingerprint}`;
    const deviceName = `${browser} on ${os}`;

    return {
      deviceId,
      deviceName,
      deviceType: deviceType as 'desktop' | 'mobile' | 'tablet',
      browser,
      browserVersion,
      os,
      osVersion,
      fingerprint
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(session: SessionData): string {
    const payload = {
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      deviceId: session.device.deviceId
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      algorithm: this.JWT_ALGORITHM,
      expiresIn: this.config.accessTokenExpiry,
      issuer: 'autolumiku',
      audience: 'access'
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(
    userId: string,
    sessionId: string,
    tokenId: string,
    deviceId: string,
    previousTokenId?: string
  ): string {
    const payload = {
      userId,
      sessionId,
      tokenId,
      deviceId,
      previousTokenId
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      algorithm: this.JWT_ALGORITHM,
      expiresIn: this.config.refreshTokenExpiry,
      issuer: 'autolumiku',
      audience: 'refresh'
    });
  }

  /**
   * Store refresh token in Redis
   */
  private async storeRefreshToken(
    token: string,
    userId: string,
    sessionId: string,
    tokenId: string,
    deviceId: string
  ): Promise<void> {
    const tokenData: RefreshTokenData = {
      tokenId,
      userId,
      sessionId,
      deviceId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.parseExpiry(this.config.refreshTokenExpiry)),
      isRevoked: false
    };

    const key = `refresh_token:${tokenId}`;
    await this.redis.setex(
      key,
      Math.floor(this.parseExpiry(this.config.refreshTokenExpiry) / 1000),
      JSON.stringify(tokenData)
    );
  }

  /**
   * Parse expiry string (e.g., '4h', '7d') to milliseconds
   */
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }

  /**
   * Clean up expired sessions (run periodically)
   * Uses SCAN instead of KEYS for production safety
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      logger.info('Starting session cleanup...');

      let cleanedCount = 0;
      let cursor = '0';

      // Use SCAN instead of KEYS to avoid blocking Redis
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH', 'session:*',
          'COUNT', 100
        );
        cursor = nextCursor;

        for (const key of keys) {
          const sessionData = await this.redis.get(key);
          if (sessionData) {
            const session: SessionData = JSON.parse(sessionData);
            if (new Date(session.expiresAt) < new Date() || !session.isActive) {
              await this.redis.del(key);
              await this.redis.srem(`user_sessions:${session.userId}`, session.sessionId);
              cleanedCount++;
            }
          }
        }
      } while (cursor !== '0');

      logger.info(`Session cleanup completed. Removed ${cleanedCount} expired sessions`);
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    totalUsers: number;
    sessionsPerDevice: Record<string, number>;
    averageSessionDuration: number;
  }> {
    try {
      const keys = await this.redis.keys('session:*');
      const sessions: SessionData[] = [];

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          if (session.isActive && new Date(session.expiresAt) > new Date()) {
            sessions.push(session);
          }
        }
      }

      const uniqueUsers = new Set(sessions.map(s => s.userId)).size;
      const sessionsPerDevice: Record<string, number> = {};

      sessions.forEach(session => {
        const deviceType = session.device.deviceType;
        sessionsPerDevice[deviceType] = (sessionsPerDevice[deviceType] || 0) + 1;
      });

      const totalDuration = sessions.reduce((sum, session) => {
        const duration = new Date(session.lastActivity).getTime() - new Date(session.createdAt).getTime();
        return sum + duration;
      }, 0);

      const averageSessionDuration = sessions.length > 0
        ? totalDuration / sessions.length
        : 0;

      return {
        totalActiveSessions: sessions.length,
        totalUsers: uniqueUsers,
        sessionsPerDevice,
        averageSessionDuration
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        totalActiveSessions: 0,
        totalUsers: 0,
        sessionsPerDevice: {},
        averageSessionDuration: 0
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Session management service closed');
  }
}

// Export singleton instance
export const sessionManagementService = new SessionManagementService();
