/**
 * Cache Service
 *
 * Handles caching operations using Redis.
 * Provides caching for branding configurations and theme CSS.
 */

import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export class CacheService {
  private readonly client: RedisClientType;
  private readonly defaultTTL: number = 3600; // 1 hour

  constructor(
    config: {
      host: string;
      port: number;
      password?: string;
      database?: number;
      keyPrefix?: string;
    },
    private readonly logger: Logger
  ) {
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.database || 0,
    });

    // Add error handling
    this.client.on('error', (error) => {
      this.logger.error('Redis client error', { error: error.message });
    });

    this.client.on('connect', () => {
      this.logger.info('Connected to Redis');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Cache service connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { error: error.message });
      throw new Error(`Failed to connect to cache: ${error.message}`);
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.logger.info('Cache service disconnected from Redis');
    } catch (error) {
      this.logger.error('Failed to disconnect from Redis', { error: error.message });
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: string,
    options?: CacheOptions
  ): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      await this.client.setEx(key, ttl, value);

      this.logger.debug('Cache set', { key, ttl });
    } catch (error) {
      this.logger.error('Failed to set cache', { key, error: error.message });
      // Don't throw error for cache failures - continue without cache
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);

      if (value) {
        this.logger.debug('Cache hit', { key });
      } else {
        this.logger.debug('Cache miss', { key });
      }

      return value;
    } catch (error) {
      this.logger.error('Failed to get cache', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      this.logger.debug('Cache deleted', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      this.logger.error('Failed to delete cache', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async deleteMultiple(keys: string[]): Promise<number> {
    try {
      const result = await this.client.del(keys);
      this.logger.debug('Multiple cache entries deleted', { keys, deleted: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to delete multiple cache entries', { keys, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Failed to check cache existence', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set multiple values in cache (pipeline)
   */
  async setMultiple(
    entries: Array<{ key: string; value: string; ttl?: number }>
  ): Promise<void> {
    try {
      const pipeline = this.client.multi();

      for (const entry of entries) {
        const ttl = entry.ttl || this.defaultTTL;
        pipeline.setEx(entry.key, ttl, entry.value);
      }

      await pipeline.exec();

      this.logger.debug('Multiple cache entries set', { count: entries.length });
    } catch (error) {
      this.logger.error('Failed to set multiple cache entries', {
        count: entries.length,
        error: error.message
      });
    }
  }

  /**
   * Get multiple values from cache (pipeline)
   */
  async getMultiple(keys: string[]): Promise<Record<string, string | null>> {
    try {
      const values = await this.client.mGet(keys);

      const result: Record<string, string | null> = {};
      keys.forEach((key, index) => {
        result[key] = values[index];
      });

      const hits = values.filter(v => v !== null).length;
      this.logger.debug('Multiple cache entries retrieved', {
        requested: keys.length,
        hits
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get multiple cache entries', {
        keys,
        error: error.message
      });

      // Return empty object on error
      return {};
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.client.incrBy(key, amount);
      this.logger.debug('Cache incremented', { key, amount, result });
      return result;
    } catch (error) {
      this.logger.error('Failed to increment cache', { key, amount, error: error.message });
      throw new Error(`Failed to increment cache: ${error.message}`);
    }
  }

  /**
   * Set value in cache only if key doesn't exist
   */
  async setIfNotExists(
    key: string,
    value: string,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      const result = await this.client.set(key, value, {
        EX: ttl,
        NX: true, // Only set if not exists
      });

      this.logger.debug('Cache set if not exists', { key, ttl, result: result === 'OK' });
      return result === 'OK';
    } catch (error) {
      this.logger.error('Failed to set cache if not exists', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const ttl = await this.client.ttl(key);
      this.logger.debug('Cache TTL retrieved', { key, ttl });
      return ttl;
    } catch (error) {
      this.logger.error('Failed to get cache TTL', { key, error: error.message });
      return -1;
    }
  }

  /**
   * Update TTL for existing key
   */
  async updateTTL(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      this.logger.debug('Cache TTL updated', { key, ttl, result });
      return result;
    } catch (error) {
      this.logger.error('Failed to update cache TTL', { key, ttl, error: error.message });
      return false;
    }
  }

  /**
   * Clear all cache (dangerous - use with caution)
   */
  async clear(): Promise<void> {
    try {
      await this.client.flushDb();
      this.logger.warn('Cache cleared - all data deleted');
    } catch (error) {
      this.logger.error('Failed to clear cache', { error: error.message });
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memoryUsage?: string;
    keyCount?: number;
    info?: any;
  }> {
    try {
      const connected = this.client.isOpen;

      if (!connected) {
        return { connected: false };
      }

      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();

      return {
        connected: true,
        keyCount,
        info
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error: error.message });
      return { connected: false };
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency
      };
    } catch (error) {
      this.logger.error('Cache health check failed', { error: error.message });
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}