/**
 * Cache Manager
 * Epic 7: Caching layer for analytics performance optimization
 */

import { CacheEntry, CacheOptions } from './types';

/**
 * Simple in-memory cache manager
 * In production, would use Redis for distributed caching
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 300; // 5 minutes in seconds

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt,
      key,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get or set with callback
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Not in cache, execute callback
    const data = await callback();

    // Store in cache
    await this.set(key, data, options);

    return data;
  }

  /**
   * Invalidate specific key
   */
  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Invalidate keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cache for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidatePattern(`^analytics:${tenantId}:`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = new Date();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: 0, // Would track in production
    };
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Generate cache key
   */
  generateKey(prefix: string, ...parts: (string | number | boolean)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache key generators
export const CACHE_KEYS = {
  salesMetrics: (tenantId: string, period: string) =>
    cacheManager.generateKey('analytics:sales', tenantId, period),

  inventoryMetrics: (tenantId: string) =>
    cacheManager.generateKey('analytics:inventory', tenantId),

  customerMetrics: (tenantId: string, period: string) =>
    cacheManager.generateKey('analytics:customers', tenantId, period),

  financialMetrics: (tenantId: string, period: string) =>
    cacheManager.generateKey('analytics:financial', tenantId, period),

  dashboardOverview: (tenantId: string, period: string) =>
    cacheManager.generateKey('analytics:dashboard', tenantId, period),
};

// Run cleanup every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    cacheManager.cleanup().catch(console.error);
  }, 10 * 60 * 1000);
}
