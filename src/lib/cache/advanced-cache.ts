/**
 * Advanced Caching Service
 * Multi-layer caching with Redis, memory cache, and CDN optimization
 * Optimized for Indonesian mobile networks and high-latency connections
 */

import { Logger } from '@/lib/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[];
  compress?: boolean;
  backgroundRefresh?: boolean;
  staleWhileRevalidate?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
  compressed?: boolean;
  version: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
}

class AdvancedCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redisCache: any = null; // Redis client
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgResponseTime: 0
  };
  private responseTimes: number[] = [];
  private logger: Logger;
  private cacheVersion: number = 1;

  constructor(
    private prefix: string = 'autolumiku',
    private defaultTTL: number = 300 // 5 minutes
  ) {
    this.logger = new Logger('AdvancedCache');
    this.initializeRedis();
    this.startBackgroundCleanup();
  }

  /**
   * Initialize Redis connection with Indonesian server optimization
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Use connection pooling for better performance
      const Redis = require('ioredis');
      this.redisCache = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        // Optimizations for Indonesian networks
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableOfflineQueue: false,
        maxLoadingTimeout: 3000
      });

      this.redisCache.on('connect', () => {
        this.logger.info('Redis connected successfully');
      });

      this.redisCache.on('error', (error: Error) => {
        this.logger.error('Redis connection error', { error });
        this.stats.errors++;
      });

    } catch (error) {
      this.logger.warn('Redis initialization failed, using memory cache only', { error });
    }
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.prefix);

    try {
      // Try memory cache first (fastest)
      const memoryResult = this.getFromMemory<T>(fullKey);
      if (memoryResult !== null) {
        this.recordHit(Date.now() - startTime);
        return memoryResult;
      }

      // Try Redis cache
      if (this.redisCache) {
        const redisResult = await this.getFromRedis<T>(fullKey);
        if (redisResult !== null) {
          // Store in memory cache for faster subsequent access
          this.setToMemory(fullKey, redisResult, options.ttl || this.defaultTTL);
          this.recordHit(Date.now() - startTime);
          return redisResult;
        }
      }

      this.recordMiss(Date.now() - startTime);
      return null;

    } catch (error) {
      this.logger.error('Cache get error', { key: fullKey, error });
      this.stats.errors++;
      this.recordMiss(Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set value in cache with multi-layer strategy
   */
  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || this.defaultTTL;

    try {
      const entry: CacheEntry = {
        data: value,
        timestamp: Date.now(),
        ttl,
        tags: options.tags || [],
        compressed: options.compress || false,
        version: this.cacheVersion
      };

      // Always set in memory cache
      this.setToMemory(fullKey, value, ttl);

      // Set in Redis if available
      if (this.redisCache) {
        await this.setToRedis(fullKey, entry, ttl);
      }

      this.stats.sets++;
      this.recordResponseTime(Date.now() - startTime);

    } catch (error) {
      this.logger.error('Cache set error', { key: fullKey, error });
      this.stats.errors++;
    }
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      // Delete from memory cache
      this.memoryCache.delete(fullKey);

      // Delete from Redis
      if (this.redisCache) {
        await this.redisCache.del(fullKey);
      }

      this.stats.deletes++;

    } catch (error) {
      this.logger.error('Cache delete error', { key: fullKey, error });
      this.stats.errors++;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    const fullPattern = this.buildKey(pattern, options.prefix);

    try {
      // Delete from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
        }
      }

      // Delete from Redis
      if (this.redisCache) {
        const keys = await this.redisCache.keys(`${fullPattern}*`);
        if (keys.length > 0) {
          await this.redisCache.del(...keys);
        }
      }

      this.stats.deletes += 1;

    } catch (error) {
      this.logger.error('Cache delete pattern error', { pattern: fullPattern, error });
      this.stats.errors++;
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    let cached = await this.get<T>(key, options);

    if (cached === null) {
      try {
        const data = await fetcher();
        await this.set(key, data, options);
        cached = data;
      } catch (error) {
        this.logger.error('Cache getOrSet fetcher error', { key, error });
        throw error;
      }
    }

    return cached;
  }

  /**
   * Warm up cache with multiple keys
   */
  async warmUp<T = any>(
    entries: Array<{ key: string; fetcher: () => Promise<T>; options?: CacheOptions }>
  ): Promise<void> {
    const promises = entries.map(async ({ key, fetcher, options }) => {
      try {
        await this.getOrSet(key, fetcher, options);
      } catch (error) {
        this.logger.error('Cache warm up error', { key, error });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      if (this.redisCache) {
        for (const tag of tags) {
          const pattern = `${this.prefix}:tag:${tag}:*`;
          const keys = await this.redisCache.keys(pattern);
          if (keys.length > 0) {
            await this.redisCache.del(...keys);
          }
        }
      }

      // Invalidate memory cache entries with matching tags
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key);
        }
      }

    } catch (error) {
      this.logger.error('Cache invalidate by tags error', { tags, error });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & {
    memoryCacheSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      memoryCacheSize: this.memoryCache.size,
      hitRate,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0
    };
    this.responseTimes = [];
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, customPrefix?: string): string {
    const prefix = customPrefix || this.prefix;
    return `${prefix}:${key}`;
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set to memory cache with size management
   */
  private setToMemory<T>(key: string, value: T, ttl: number): void {
    // Implement LRU eviction if cache gets too large
    const maxMemorySize = 1000; // Maximum number of entries
    if (this.memoryCache.size >= maxMemorySize) {
      // Remove oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      data: value,
      timestamp: Date.now(),
      ttl,
      tags: [],
      version: this.cacheVersion
    };

    this.memoryCache.set(key, entry);
  }

  /**
   * Get from Redis cache
   */
  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redisCache) return null;

    const data = await this.redisCache.get(key);
    if (!data) return null;

    try {
      const entry: CacheEntry = JSON.parse(data);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        await this.redisCache.del(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      this.logger.error('Redis parse error', { key, error });
      await this.redisCache.del(key);
      return null;
    }
  }

  /**
   * Set to Redis cache
   */
  private async setToRedis(key: string, entry: CacheEntry, ttl: number): Promise<void> {
    if (!this.redisCache) return;

    const data = JSON.stringify(entry);
    await this.redisCache.setex(key, ttl, data);
  }

  /**
   * Record cache hit
   */
  private recordHit(responseTime: number): void {
    this.stats.hits++;
    this.recordResponseTime(responseTime);
  }

  /**
   * Record cache miss
   */
  private recordMiss(responseTime: number): void {
    this.stats.misses++;
    this.recordResponseTime(responseTime);
  }

  /**
   * Record response time for statistics
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only last 100 response times for average calculation
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.stats.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Start background cleanup process
   */
  private startBackgroundCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Preload critical cache entries for Indonesian mobile users
   */
  async preloadCriticalData(): Promise<void> {
    const criticalEntries = [
      {
        key: 'indonesian_roles',
        fetcher: async () => {
          // Preload Indonesian dealership roles
          return [
            { name: 'showroom_manager', displayName: 'Showroom Manager' },
            { name: 'sales_manager', displayName: 'Sales Manager' },
            { name: 'sales_executive', displayName: 'Sales Executive' },
            { name: 'finance_manager', displayName: 'Finance Manager' }
          ];
        },
        options: { ttl: 3600, tags: ['roles', 'indonesian'] }
      },
      {
        key: 'mobile_ui_config',
        fetcher: async () => {
          // Preload mobile-optimized UI configuration
          return {
            theme: 'light',
            language: 'id',
            optimizedForMobile: true,
            lowBandwidthMode: true
          };
        },
        options: { ttl: 7200, tags: ['ui', 'mobile'] }
      }
    ];

    await this.warmUp(criticalEntries);
    this.logger.info('Critical cache data preloaded for Indonesian mobile users');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.redisCache) {
      await this.redisCache.quit();
    }
    this.memoryCache.clear();
    this.logger.info('Cache service shut down gracefully');
  }
}

// Export singleton instance
export const advancedCache = new AdvancedCache();

// Export class for custom instances
export { AdvancedCache };