/**
 * API Key Management Service
 * Epic: Cross-Cutting Security
 * Story SC.5: API Security and Integration Protection
 *
 * Provides API key generation, validation, and management for third-party integrations
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ============================================================================
// Types
// ============================================================================

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string; // First 8 chars for identification (e.g., "sk_live_")
  keyHash: string; // Hashed full key
  permissions: string[];
  rateLimit: number; // Requests per minute
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  tenantId: string;
  name: string;
  permissions: ApiKeyPermission[];
  rateLimit?: number; // Default: 100 req/min
  expiresInDays?: number; // Optional expiration
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
  remainingQuota?: number;
}

export enum ApiKeyPermission {
  // Vehicle operations
  READ_VEHICLES = 'vehicles:read',
  WRITE_VEHICLES = 'vehicles:write',
  DELETE_VEHICLES = 'vehicles:delete',

  // Lead operations
  READ_LEADS = 'leads:read',
  WRITE_LEADS = 'leads:write',

  // Analytics
  READ_ANALYTICS = 'analytics:read',

  // Catalog
  READ_CATALOG = 'catalog:read',

  // Full access
  FULL_ACCESS = '*',
}

// ============================================================================
// API Key Service
// ============================================================================

export class ApiKeyService {
  /**
   * Generate a new API key
   */
  async generateApiKey(request: CreateApiKeyRequest): Promise<{
    success: boolean;
    apiKey?: ApiKey;
    plainKey?: string; // Only returned once!
    message?: string;
  }> {
    try {
      // Generate random API key
      const randomBytes = crypto.randomBytes(32);
      const plainKey = `sk_live_${randomBytes.toString('base64url')}`; // Format: sk_live_xxxxx
      const keyPrefix = plainKey.substring(0, 15); // Store prefix for identification

      // Hash the key (never store plain key!)
      const keyHash = await bcrypt.hash(plainKey, 10);

      // Calculate expiration
      const expiresAt = request.expiresInDays
        ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      // Create API key in database
      const apiKey = await prisma.apiKey.create({
        data: {
          tenantId: request.tenantId,
          name: request.name,
          keyPrefix,
          keyHash,
          permissions: request.permissions,
          rateLimit: request.rateLimit || 100, // Default 100 req/min
          expiresAt,
          isActive: true,
        },
      });

      return {
        success: true,
        apiKey: apiKey as ApiKey,
        plainKey, // ⚠️ Only shown once! User must save it
      };
    } catch (error: any) {
      console.error('Generate API key failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to generate API key',
      };
    }
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(
    plainKey: string,
    requiredPermission?: string
  ): Promise<ApiKeyValidationResult> {
    try {
      // Extract prefix
      const keyPrefix = plainKey.substring(0, 15);

      // Find API key by prefix
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          keyPrefix,
          isActive: true,
        },
      });

      if (!apiKey) {
        return {
          valid: false,
          error: 'Invalid API key',
        };
      }

      // Verify key hash
      const keyMatches = await bcrypt.compare(plainKey, apiKey.keyHash);
      if (!keyMatches) {
        return {
          valid: false,
          error: 'Invalid API key',
        };
      }

      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return {
          valid: false,
          error: 'API key expired',
        };
      }

      // Check permission if required
      if (requiredPermission) {
        const hasPermission =
          apiKey.permissions.includes('*') || apiKey.permissions.includes(requiredPermission);

        if (!hasPermission) {
          return {
            valid: false,
            error: `Missing permission: ${requiredPermission}`,
          };
        }
      }

      // Check rate limit
      const rateLimitOk = await this.checkRateLimit(apiKey.id, apiKey.rateLimit);
      if (!rateLimitOk.allowed) {
        return {
          valid: false,
          error: 'Rate limit exceeded',
          remainingQuota: 0,
        };
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        valid: true,
        apiKey: apiKey as ApiKey,
        remainingQuota: rateLimitOk.remaining,
      };
    } catch (error: any) {
      console.error('Validate API key failed:', error);
      return {
        valid: false,
        error: 'API key validation failed',
      };
    }
  }

  /**
   * Check rate limit for API key
   * Uses sliding window algorithm
   */
  async checkRateLimit(
    apiKeyId: string,
    rateLimit: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const windowStart = now - windowMs;

    // Count requests in current window
    const requestCount = await prisma.apiKeyUsage.count({
      where: {
        apiKeyId,
        timestamp: {
          gte: new Date(windowStart),
        },
      },
    });

    const allowed = requestCount < rateLimit;
    const remaining = Math.max(0, rateLimit - requestCount - 1);

    if (allowed) {
      // Record this request
      await prisma.apiKeyUsage.create({
        data: {
          apiKeyId,
          timestamp: new Date(),
        },
      });
    }

    return { allowed, remaining };
  }

  /**
   * List API keys for tenant
   */
  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return keys as ApiKey[];
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { isActive: false },
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to revoke API key',
      };
    }
  }

  /**
   * Rotate API key (generate new key, revoke old one)
   */
  async rotateApiKey(
    apiKeyId: string
  ): Promise<{ success: boolean; newKey?: string; message?: string }> {
    try {
      const oldKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyId },
      });

      if (!oldKey) {
        return { success: false, message: 'API key not found' };
      }

      // Generate new key with same settings
      const result = await this.generateApiKey({
        tenantId: oldKey.tenantId,
        name: oldKey.name,
        permissions: oldKey.permissions as ApiKeyPermission[],
        rateLimit: oldKey.rateLimit,
      });

      if (!result.success) {
        return { success: false, message: result.message };
      }

      // Revoke old key
      await this.revokeApiKey(apiKeyId);

      return {
        success: true,
        newKey: result.plainKey,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to rotate API key',
      };
    }
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyUsage(apiKeyId: string, days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await prisma.apiKeyUsage.groupBy({
      by: ['apiKeyId'],
      where: {
        apiKeyId,
        timestamp: { gte: since },
      },
      _count: { id: true },
    });

    // Group by day
    const usageByDay = await prisma.$queryRaw<
      { date: string; count: number }[]
    >`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM api_key_usage
      WHERE api_key_id = ${apiKeyId}
        AND timestamp >= ${since}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    return {
      totalRequests: usage[0]?._count.id || 0,
      usageByDay,
    };
  }

  /**
   * Clean up old usage records (run daily via cron)
   */
  async cleanupOldUsageRecords(daysToKeep: number = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.apiKeyUsage.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    console.log(`Cleaned up ${result.count} old API key usage records`);
    return result.count;
  }
}

export const apiKeyService = new ApiKeyService();
