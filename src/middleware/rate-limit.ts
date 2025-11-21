/**
 * Rate Limiting Middleware
 * Protects endpoints from brute force and abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  message?: string; // Custom error message
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many requests, please try again later'
};

/**
 * Rate limit middleware factory
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimit(req: NextRequest): Promise<NextResponse | null> {
    try {
      // Generate key (default: IP-based)
      const key = finalConfig.keyGenerator
        ? finalConfig.keyGenerator(req)
        : `ratelimit:${req.ip || req.headers.get('x-forwarded-for') || 'unknown'}:${req.nextUrl.pathname}`;

      // Get current count
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= finalConfig.maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(finalConfig.windowMs / 1000);

        return NextResponse.json(
          {
            success: false,
            error: finalConfig.message,
            retryAfter
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': (Date.now() + retryAfter * 1000).toString()
            }
          }
        );
      }

      // Increment counter
      const multi = redis.multi();
      multi.incr(key);
      if (count === 0) {
        multi.pexpire(key, finalConfig.windowMs);
      }
      await multi.exec();

      // Add rate limit headers to response (will be added by caller)
      // Return null to indicate rate limit passed
      return null;
    } catch (error) {
      // On error, allow request (fail open for availability)
      console.error('Rate limit check failed:', error);
      return null;
    }
  };
}

/**
 * Predefined rate limiters for common scenarios
 */
export const rateLimiters = {
  // Auth endpoints: 5 requests per 15 minutes per IP
  auth: rateLimiter({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many authentication attempts, please try again later'
  }),

  // Token refresh: 10 requests per minute per user
  refresh: rateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: 'Too many refresh requests, please slow down'
  }),

  // API general: 100 requests per minute per IP
  api: rateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000
  }),

  // Session management: 20 requests per minute per user
  session: rateLimiter({
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: 'Too many session requests, please slow down'
  })
};
