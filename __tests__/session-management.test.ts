import { SessionManagementService } from '../src/services/session-management.service';
import Redis from 'ioredis-mock';

// Mock Redis
jest.mock('ioredis', () => require('ioredis-mock'));

describe('SessionManagementService', () => {
  let service: SessionManagementService;

  beforeEach(() => {
    service = new SessionManagementService({
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '7d',
      sessionTimeout: 30 * 60 * 1000,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      maxDevicesPerUser: 3,
      enableOfflineMode: true,
      networkOptimization: {
        enableCompression: true,
        reducedPayload: true,
        cachingStrategy: 'aggressive'
      }
    });
  });

  afterEach(async () => {
    await service.close();
  });

  describe('Session Creation', () => {
    it('should create a new session with valid tokens', async () => {
      const result = await service.createSession(
        'user-123',
        'tenant-456',
        'test@example.com',
        'admin',
        ['read', 'write'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124'
        }
      );

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result.sessionId).toMatch(/^sess_/);
    });

    it('should enforce max devices per user limit', async () => {
      const userId = 'user-max-devices';
      const tenantId = 'tenant-123';

      // Create max allowed sessions
      for (let i = 0; i < 3; i++) {
        await service.createSession(
          userId,
          tenantId,
          'test@example.com',
          'admin',
          ['read'],
          {
            ipAddress: `192.168.1.${i}`,
            userAgent: 'Chrome/91.0'
          }
        );
      }

      // Verify only 3 sessions exist
      const sessions = await service.getUserActiveSessions(userId);
      expect(sessions.length).toBe(3);

      // Create one more session (should remove oldest)
      await service.createSession(
        userId,
        tenantId,
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.4',
          userAgent: 'Chrome/91.0'
        }
      );

      // Verify still only 3 sessions (oldest removed)
      const updatedSessions = await service.getUserActiveSessions(userId);
      expect(updatedSessions.length).toBe(3);
    });

    it('should generate device fingerprint correctly', async () => {
      const result = await service.createSession(
        'user-fingerprint',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
        }
      );

      const sessions = await service.getUserActiveSessions('user-fingerprint');
      expect(sessions[0].device.deviceType).toBe('mobile');
      expect(sessions[0].device.fingerprint).toBeTruthy();
      expect(sessions[0].device.deviceId).toMatch(/^device_/);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token successfully', async () => {
      const createResult = await service.createSession(
        'user-refresh',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read', 'write'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      const refreshResult = await service.refreshSession(createResult.refreshToken);

      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(refreshResult).toHaveProperty('expiresAt');
      expect(refreshResult.refreshToken).not.toBe(createResult.refreshToken); // Token rotation
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token';

      await expect(service.refreshSession(expiredToken)).rejects.toThrow();
    });

    it('should rotate refresh tokens on each refresh', async () => {
      const createResult = await service.createSession(
        'user-rotation',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      const refresh1 = await service.refreshSession(createResult.refreshToken);
      const refresh2 = await service.refreshSession(refresh1.refreshToken);

      expect(refresh1.refreshToken).not.toBe(createResult.refreshToken);
      expect(refresh2.refreshToken).not.toBe(refresh1.refreshToken);
    });
  });

  describe('Session Verification', () => {
    it('should verify valid access token', async () => {
      const createResult = await service.createSession(
        'user-verify',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      const session = await service.verifySession(createResult.accessToken);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user-verify');
      expect(session?.tenantId).toBe('tenant-123');
      expect(session?.isActive).toBe(true);
    });

    it('should reject invalid access token', async () => {
      const invalidToken = 'invalid.token.here';
      const session = await service.verifySession(invalidToken);

      expect(session).toBeNull();
    });

    it('should update last activity on verification', async () => {
      const createResult = await service.createSession(
        'user-activity',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      const session1 = await service.verifySession(createResult.accessToken);
      const initialActivity = session1?.lastActivity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const session2 = await service.verifySession(createResult.accessToken);
      const updatedActivity = session2?.lastActivity;

      expect(new Date(updatedActivity!).getTime()).toBeGreaterThan(
        new Date(initialActivity!).getTime()
      );
    });
  });

  describe('Session Revocation', () => {
    it('should revoke a single session', async () => {
      const createResult = await service.createSession(
        'user-revoke',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      await service.revokeSession(createResult.sessionId);

      const session = await service.verifySession(createResult.accessToken);
      expect(session).toBeNull();
    });

    it('should revoke all user sessions', async () => {
      const userId = 'user-revoke-all';

      // Create multiple sessions
      await service.createSession(
        userId,
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      await service.createSession(
        userId,
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.2',
          userAgent: 'Firefox/89.0'
        }
      );

      let sessions = await service.getUserActiveSessions(userId);
      expect(sessions.length).toBe(2);

      await service.revokeAllUserSessions(userId);

      sessions = await service.getUserActiveSessions(userId);
      expect(sessions.length).toBe(0);
    });
  });

  describe('Failed Login Tracking', () => {
    it('should track failed login attempts', async () => {
      const userId = 'user-failed-login';

      for (let i = 0; i < 3; i++) {
        const result = await service.trackFailedLogin(
          userId,
          '192.168.1.1',
          'Chrome/91.0'
        );
        expect(result.locked).toBe(false);
        expect(result.attemptsRemaining).toBe(5 - (i + 1));
      }
    });

    it('should lock account after max failed attempts', async () => {
      const userId = 'user-lockout';

      for (let i = 0; i < 5; i++) {
        await service.trackFailedLogin(userId, '192.168.1.1', 'Chrome/91.0');
      }

      const isLocked = await service.isUserLockedOut(userId);
      expect(isLocked).toBe(true);
    });

    it('should clear failed attempts after successful login', async () => {
      const userId = 'user-clear-attempts';

      await service.trackFailedLogin(userId, '192.168.1.1', 'Chrome/91.0');
      await service.trackFailedLogin(userId, '192.168.1.1', 'Chrome/91.0');

      await service.clearFailedAttempts(userId);

      const result = await service.trackFailedLogin(userId, '192.168.1.1', 'Chrome/91.0');
      expect(result.attemptsRemaining).toBe(4); // Reset to max - 1
    });
  });

  describe('Multi-Device Session Management', () => {
    it('should list all active sessions for user', async () => {
      const userId = 'user-multi-device';
      const tenantId = 'tenant-123';

      await service.createSession(
        userId,
        tenantId,
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
        }
      );

      await service.createSession(
        userId,
        tenantId,
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6) Safari/604.1'
        }
      );

      const sessions = await service.getUserActiveSessions(userId);
      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.device.deviceType === 'desktop')).toBe(true);
      expect(sessions.some(s => s.device.deviceType === 'mobile')).toBe(true);
    });
  });

  describe('Session Statistics', () => {
    it('should calculate session statistics correctly', async () => {
      // Create some sessions
      await service.createSession(
        'user-1',
        'tenant-1',
        'user1@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0 (Windows)'
        }
      );

      await service.createSession(
        'user-2',
        'tenant-1',
        'user2@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.2',
          userAgent: 'Safari/14.0 (iPhone)'
        }
      );

      const stats = await service.getSessionStats();

      expect(stats.totalActiveSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(stats.sessionsPerDevice).toHaveProperty('desktop');
      expect(stats.sessionsPerDevice).toHaveProperty('mobile');
    });
  });

  describe('Indonesian Network Optimization', () => {
    it('should enable offline mode for Indonesian networks', () => {
      const optimizedService = new SessionManagementService({
        enableOfflineMode: true,
        networkOptimization: {
          enableCompression: true,
          reducedPayload: true,
          cachingStrategy: 'aggressive'
        }
      });

      expect(optimizedService).toBeDefined();
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up expired sessions', async () => {
      const shortLivedService = new SessionManagementService({
        accessTokenExpiry: '1s', // 1 second for testing
        refreshTokenExpiry: '5s'
      });

      await shortLivedService.createSession(
        'user-cleanup',
        'tenant-123',
        'test@example.com',
        'admin',
        ['read'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0'
        }
      );

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 2000));

      await shortLivedService.cleanupExpiredSessions();

      const sessions = await shortLivedService.getUserActiveSessions('user-cleanup');
      expect(sessions.length).toBe(0);

      await shortLivedService.close();
    });
  });
});
