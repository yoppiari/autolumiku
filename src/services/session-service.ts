/**
 * Session Management Service
 * Epic 1: Story 1.3 - Session Management & Security
 *
 * Handles user sessions, device tracking, suspicious activity detection,
 * and session lifecycle management for the AutoLumiKu platform.
 */

import { prisma } from '@/lib/prisma';
import { Session } from '@prisma/client';
import crypto from 'crypto';

const SESSION_TIMEOUT_DAYS = parseInt(process.env.SESSION_TIMEOUT_DAYS || '30');

/**
 * Device information for session tracking
 */
export interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser?: string;
  os?: string;
  location?: string;
}

/**
 * Session with user information
 */
export interface SessionWithUser extends Session {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Suspicious activity alert
 */
export interface SuspiciousActivity {
  type: 'new_device' | 'new_location' | 'multiple_locations' | 'unusual_time';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: any;
}

export class SessionService {
  /**
   * Create a new session for user
   */
  async createSession(
    userId: string,
    deviceInfo: DeviceInfo,
    expiresInDays: number = SESSION_TIMEOUT_DAYS
  ): Promise<Session> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const session = await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.deviceType,
      },
    });

    // Log session creation
    await this.logSecurityEvent(userId, 'session_created', {
      sessionId: session.id,
      deviceInfo,
    });

    return session;
  }

  /**
   * Get session by ID with user information
   */
  async getSession(sessionId: string): Promise<SessionWithUser | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return session;
    } catch (error) {
      console.error('Get session failed:', error);
      return null;
    }
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return sessions;
    } catch (error) {
      console.error('Get user sessions failed:', error);
      return [];
    }
  }

  /**
   * Validate session and check for suspicious activity
   */
  async validateSession(
    sessionId: string,
    currentDeviceInfo?: DeviceInfo
  ): Promise<{
    valid: boolean;
    session?: Session;
    suspiciousActivities?: SuspiciousActivity[];
  }> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { valid: false };
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return { valid: false };
    }

    // Check if session is revoked
    if (session.revokedAt) {
      return { valid: false };
    }

    // Check for suspicious activity if device info provided
    let suspiciousActivities: SuspiciousActivity[] = [];
    if (currentDeviceInfo) {
      suspiciousActivities = await this.detectSuspiciousActivity(
        session.userId,
        session,
        currentDeviceInfo
      );

      // Log suspicious activities
      if (suspiciousActivities.length > 0) {
        for (const activity of suspiciousActivities) {
          await this.logSecurityEvent(session.userId, 'suspicious_activity_detected', {
            sessionId,
            activity,
          });
        }
      }
    }

    return {
      valid: true,
      session,
      suspiciousActivities: suspiciousActivities.length > 0 ? suspiciousActivities : undefined,
    };
  }

  /**
   * Revoke session (logout)
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.logSecurityEvent(session.userId, 'session_revoked', {
        sessionId,
      });

      return true;
    } catch (error) {
      console.error('Revoke session failed:', error);
      return false;
    }
  }

  /**
   * Revoke all sessions for user (force logout everywhere)
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where: {
          userId,
          id: exceptSessionId ? { not: exceptSessionId } : undefined,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.logSecurityEvent(userId, 'all_sessions_revoked', {
        count: result.count,
        exceptSessionId,
      });

      return result.count;
    } catch (error) {
      console.error('Revoke all sessions failed:', error);
      return 0;
    }
  }

  /**
   * Extend session expiry
   */
  async extendSession(sessionId: string, additionalDays: number = 30): Promise<Session | null> {
    try {
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);

      const session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          expiresAt: newExpiryDate,
        },
      });

      return session;
    } catch (error) {
      console.error('Extend session failed:', error);
      return null;
    }
  }

  /**
   * Clean up expired sessions (cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            {
              revokedAt: {
                lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
              },
            },
          ],
        },
      });

      console.log(`Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      console.error('Cleanup sessions failed:', error);
      return 0;
    }
  }

  /**
   * Detect suspicious activity based on device and location
   */
  private async detectSuspiciousActivity(
    userId: string,
    currentSession: Session,
    newDeviceInfo: DeviceInfo
  ): Promise<SuspiciousActivity[]> {
    const activities: SuspiciousActivity[] = [];

    // Get recent sessions for this user
    const recentSessions = await prisma.session.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check for new device
    const deviceMatch = recentSessions.find(
      (s) =>
        s.id !== currentSession.id &&
        s.userAgent === newDeviceInfo.userAgent &&
        s.deviceType === newDeviceInfo.deviceType
    );

    if (!deviceMatch && recentSessions.length > 0) {
      activities.push({
        type: 'new_device',
        severity: 'medium',
        message: 'Login detected from a new device',
        details: {
          deviceType: newDeviceInfo.deviceType,
          userAgent: newDeviceInfo.userAgent,
        },
      });
    }

    // Check for new location (different IP address)
    const locationMatch = recentSessions.find(
      (s) => s.id !== currentSession.id && s.ipAddress === newDeviceInfo.ipAddress
    );

    if (!locationMatch && recentSessions.length > 0) {
      activities.push({
        type: 'new_location',
        severity: 'medium',
        message: 'Login detected from a new location',
        details: {
          ipAddress: newDeviceInfo.ipAddress,
        },
      });
    }

    // Check for multiple concurrent sessions from different locations
    const activeSessions = recentSessions.filter(
      (s) =>
        !s.revokedAt &&
        s.expiresAt > new Date() &&
        s.ipAddress !== newDeviceInfo.ipAddress
    );

    if (activeSessions.length >= 3) {
      activities.push({
        type: 'multiple_locations',
        severity: 'high',
        message: 'Multiple active sessions detected from different locations',
        details: {
          sessionCount: activeSessions.length + 1,
          locations: [...new Set(activeSessions.map((s) => s.ipAddress))],
        },
      });
    }

    // Check for unusual time (login at odd hours)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) {
      // 2 AM - 5 AM is considered unusual
      const recentNightLogins = recentSessions.filter((s) => {
        const sessionHour = s.createdAt.getHours();
        return sessionHour >= 2 && sessionHour <= 5;
      });

      if (recentNightLogins.length === 0) {
        activities.push({
          type: 'unusual_time',
          severity: 'low',
          message: 'Login detected at unusual time',
          details: {
            hour,
          },
        });
      }
    }

    return activities;
  }

  /**
   * Parse user agent to extract device information
   */
  parseUserAgent(userAgent: string): Pick<DeviceInfo, 'deviceType' | 'browser' | 'os'> {
    const ua = userAgent.toLowerCase();

    // Device type detection
    let deviceType: DeviceInfo['deviceType'] = 'unknown';
    if (ua.includes('mobile') || ua.includes('android')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    } else if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) {
      deviceType = 'desktop';
    }

    // Browser detection
    let browser: string | undefined;
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // OS detection
    let os: string | undefined;
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return { deviceType, browser, os };
  }

  /**
   * Get session statistics for user
   */
  async getSessionStats(userId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    devicesUsed: number;
    uniqueLocations: number;
  }> {
    const sessions = await prisma.session.findMany({
      where: { userId },
    });

    const activeSessions = sessions.filter(
      (s) => !s.revokedAt && s.expiresAt > new Date()
    );

    const uniqueDevices = new Set(sessions.map((s) => s.userAgent)).size;
    const uniqueLocations = new Set(sessions.map((s) => s.ipAddress)).size;

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      devicesUsed: uniqueDevices,
      uniqueLocations: uniqueLocations,
    };
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    metadata: any
  ): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId,
          eventType,
          severity: this.getEventSeverity(eventType),
          ipAddress: metadata.deviceInfo?.ipAddress || '',
          userAgent: metadata.deviceInfo?.userAgent || '',
          metadata: metadata as any,
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
    const highSeverity = ['all_sessions_revoked', 'suspicious_activity_detected'];
    const mediumSeverity = ['session_revoked'];

    if (highSeverity.includes(eventType)) return 'high';
    if (mediumSeverity.includes(eventType)) return 'medium';
    return 'low';
  }
}

export const sessionService = new SessionService();
