import { createLogger } from 'winston';
import Redis from 'ioredis';
import { TenantBranding } from '@/types/tenant-branding';

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

export interface SessionUpdateData {
  tenantId: string;
  branding: TenantBranding;
  timestamp: Date;
  updateType: 'branding_change' | 'logo_change' | 'color_change' | 'company_info_change';
}

export interface RealtimeUpdateMessage {
  type: 'branding_update';
  data: SessionUpdateData;
  channels: string[];
}

/**
 * Real-time session update service for tenant branding changes
 */
export class RealtimeSessionService {
  private redis: Redis;
  private sessionUpdateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Start the session update service
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting real-time session update service');

      // Start periodic session updates
      this.sessionUpdateInterval = setInterval(
        () => this.processSessionUpdates(),
        this.UPDATE_INTERVAL
      );

      logger.info('Real-time session update service started successfully');
    } catch (error) {
      logger.error('Failed to start real-time session service:', error);
      throw error;
    }
  }

  /**
   * Stop the session update service
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping real-time session update service');

      if (this.sessionUpdateInterval) {
        clearInterval(this.sessionUpdateInterval);
        this.sessionUpdateInterval = null;
      }

      await this.redis.quit();
      logger.info('Real-time session update service stopped');
    } catch (error) {
      logger.error('Failed to stop real-time session service:', error);
    }
  }

  /**
   * Trigger immediate branding update for tenant sessions
   */
  async triggerBrandingUpdate(
    tenantId: string,
    branding: TenantBranding,
    updateType: SessionUpdateData['updateType'] = 'branding_change'
  ): Promise<void> {
    try {
      logger.info(`Triggering branding update for tenant: ${tenantId}, type: ${updateType}`);

      const updateData: SessionUpdateData = {
        tenantId,
        branding,
        timestamp: new Date(),
        updateType
      };

      // Store update in Redis for session workers to process
      await this.redis.setex(
        `branding_update:${tenantId}`,
        3600, // 1 hour TTL
        JSON.stringify(updateData)
      );

      // Publish real-time update to WebSocket channels
      await this.publishRealtimeUpdate(updateData);

      // Invalidate relevant caches
      await this.invalidateTenantCaches(tenantId);

      logger.info(`Branding update triggered successfully for tenant: ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to trigger branding update for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Process pending session updates
   */
  private async processSessionUpdates(): Promise<void> {
    try {
      logger.debug('Processing session updates');

      // Get all pending branding updates
      const keys = await this.redis.keys('branding_update:*');

      if (keys.length === 0) {
        logger.debug('No pending branding updates found');
        return;
      }

      logger.info(`Processing ${keys.length} pending branding updates`);

      for (const key of keys) {
        try {
          const updateData = await this.redis.get(key);
          if (!updateData) continue;

          const update: SessionUpdateData = JSON.parse(updateData);
          await this.updateActiveSessions(update);

          // Remove processed update
          await this.redis.del(key);

        } catch (error) {
          logger.error(`Failed to process update for key ${key}:`, error);
        }
      }

      logger.info('Session updates processed successfully');
    } catch (error) {
      logger.error('Failed to process session updates:', error);
    }
  }

  /**
   * Update active sessions with new branding data
   */
  private async updateActiveSessions(updateData: SessionUpdateData): Promise<void> {
    try {
      // Get all active sessions for the tenant
      const sessionKeys = await this.redis.keys(`session:${updateData.tenantId}:*`);

      logger.info(`Updating ${sessionKeys.length} active sessions for tenant: ${updateData.tenantId}`);

      const updateMessage: RealtimeUpdateMessage = {
        type: 'branding_update',
        data: updateData,
        channels: [`tenant:${updateData.tenantId}`, `branding:${updateData.tenantId}`]
      };

      // Update each session with new branding data
      for (const sessionKey of sessionKeys) {
        try {
          const sessionData = await this.redis.hgetall(sessionKey);

          if (sessionData && sessionData.userId) {
            // Store branding update in session
            await this.redis.hset(sessionKey, {
              lastBrandingUpdate: JSON.stringify(updateData),
              updatedAt: new Date().toISOString()
            });

            // Add session to notification queue
            await this.redis.lpush(
              `session_notifications:${sessionData.userId}`,
              JSON.stringify(updateMessage)
            );

            // Set TTL for notifications (24 hours)
            await this.redis.expire(`session_notifications:${sessionData.userId}`, 86400);
          }

        } catch (error) {
          logger.error(`Failed to update session ${sessionKey}:`, error);
        }
      }

      // Trigger WebSocket notifications
      await this.triggerWebSocketNotifications(updateMessage);

    } catch (error) {
      logger.error(`Failed to update active sessions for tenant ${updateData.tenantId}:`, error);
    }
  }

  /**
   * Publish real-time update to WebSocket channels
   */
  private async publishRealtimeUpdate(updateData: SessionUpdateData): Promise<void> {
    try {
      const message: RealtimeUpdateMessage = {
        type: 'branding_update',
        data: updateData,
        channels: [
          `tenant:${updateData.tenantId}`,
          `branding:${updateData.tenantId}`,
          'global_branding_updates'
        ]
      };

      // Publish to Redis pub/sub for WebSocket servers
      await this.redis.publish('realtime_updates', JSON.stringify(message));

      logger.debug(`Real-time update published for tenant: ${updateData.tenantId}`);
    } catch (error) {
      logger.error(`Failed to publish real-time update for tenant ${updateData.tenantId}:`, error);
    }
  }

  /**
   * Trigger WebSocket notifications for connected clients
   */
  private async triggerWebSocketNotifications(message: RealtimeUpdateMessage): Promise<void> {
    try {
      // In a real implementation, this would integrate with your WebSocket server
      // For now, we'll queue the notifications for WebSocket servers to process

      await this.redis.lpush(
        'websocket_notifications',
        JSON.stringify(message)
      );

      // Set TTL for notifications (1 hour)
      await this.redis.expire('websocket_notifications', 3600);

      logger.debug('WebSocket notifications queued');
    } catch (error) {
      logger.error('Failed to trigger WebSocket notifications:', error);
    }
  }

  /**
   * Invalidate tenant caches when branding changes
   */
  private async invalidateTenantCaches(tenantId: string): Promise<void> {
    try {
      // Invalidate branding cache
      await this.redis.del(`branding:${tenantId}`);

      // Invalidate theme cache
      await this.redis.del(`theme:${tenantId}`);

      // Invalidate CSS cache
      await this.redis.del(`css:${tenantId}`);

      // Invalidate preview cache
      await this.redis.del(`preview:${tenantId}`);

      logger.info(`Cache invalidated for tenant: ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to invalidate caches for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Get pending updates for a user
   */
  async getPendingUpdates(userId: string): Promise<RealtimeUpdateMessage[]> {
    try {
      const notifications = await this.redis.lrange(
        `session_notifications:${userId}`,
        0,
        -1
      );

      // Parse and return notifications
      const updates = notifications.map(notification =>
        JSON.parse(notification)
      );

      // Clear processed notifications
      await this.redis.del(`session_notifications:${userId}`);

      return updates;
    } catch (error) {
      logger.error(`Failed to get pending updates for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get session update statistics
   */
  async getSessionStats(): Promise<{
    activeSessions: number;
    pendingUpdates: number;
    lastUpdateTime: Date | null;
  }> {
    try {
      const activeSessions = await this.redis.keys('session:*');
      const pendingUpdates = await this.redis.keys('branding_update:*');

      const lastUpdate = await this.redis.get('last_session_update');

      return {
        activeSessions: activeSessions.length,
        pendingUpdates: pendingUpdates.length,
        lastUpdateTime: lastUpdate ? new Date(lastUpdate) : null
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        activeSessions: 0,
        pendingUpdates: 0,
        lastUpdateTime: null
      };
    }
  }
}

export const realtimeSessionService = new RealtimeSessionService();