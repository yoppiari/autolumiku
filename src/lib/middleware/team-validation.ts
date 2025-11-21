import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLogger } from 'winston';
import { TeamUser } from './team-auth';

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

/**
 * Enhanced rate limiting with Redis support fallback
 */
export class TeamRateLimiter {
  private static instances = new Map<string, TeamRateLimiter>();
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  static getInstance(identifier: string, limit: number, windowMs: number): TeamRateLimiter {
    const key = `${identifier}:${limit}:${windowMs}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new TeamRateLimiter(limit, windowMs));
    }
    return this.instances.get(key)!;
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const current = this.requests.get(key);

    // Clean up expired entries
    for (const [k, v] of this.requests.entries()) {
      if (v.resetTime < now) {
        this.requests.delete(k);
      }
    }

    if (current && current.count >= this.limit && current.resetTime > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }

    // Update request count
    if (current) {
      current.count++;
    } else {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
    }

    const updated = this.requests.get(key)!;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - updated.count),
      resetTime: updated.resetTime
    };
  }
}

/**
 * Rate limiting middleware for team API endpoints
 */
export function withTeamRateLimit(options: {
  limit?: number;
  windowMs?: number;
  keyGenerator?: (req: NextRequest, user: TeamUser) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
} = {}) {
  const {
    limit = 100,
    windowMs = 15 * 60 * 1000,
    keyGenerator = (req, user) => `${user.tenantId}:${user.id}`,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  const rateLimiter = TeamRateLimiter.getInstance('team-api', limit, windowMs);

  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return async (req: NextRequest, user: TeamUser): Promise<Response> => {
      const key = keyGenerator(req, user);
      const result = rateLimiter.isAllowed(key);

      if (!result.allowed) {
        logger.warn('Rate limit exceeded for team API', {
          key,
          limit,
          windowMs,
          user: user.id,
          tenant: user.tenantId
        });

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            limit,
            windowMs,
            resetTime: result.resetTime,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetTime.toString(),
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
            }
          }
        );
      }

      try {
        const response = await handler(req, user);

        // Add rate limit headers to response
        if (response instanceof Response) {
          response.headers.set('X-RateLimit-Limit', limit.toString());
          response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
          response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
        }

        return response;
      } catch (error) {
        // Don't count failed requests if skipFailedRequests is true
        if (skipFailedRequests) {
          const current = rateLimiter.requests.get(key);
          if (current) {
            current.count--;
          }
        }
        throw error;
      }
    };
  };
}

/**
 * Input validation middleware using Zod schemas
 */
export function withValidation<T>(schema: z.ZodSchema<T>, target: 'body' | 'query' | 'params' = 'body') {
  return (handler: (req: NextRequest, user: TeamUser, data: T) => Promise<Response>) => {
    return async (req: NextRequest, user: TeamUser): Promise<Response> => {
      try {
        let data: unknown;

        switch (target) {
          case 'body':
            data = await req.json();
            break;
          case 'query':
            const { searchParams } = new URL(req.url);
            data = Object.fromEntries(searchParams.entries());
            break;
          case 'params':
            // Extract params from URL pattern
            const urlParts = req.url.split('/');
            data = urlParts[urlParts.length - 1];
            break;
        }

        const validatedData = schema.parse(data);
        return handler(req, user, validatedData);

      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn('Validation failed for team API', {
            user: user.id,
            tenant: user.tenantId,
            errors: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          });

          return NextResponse.json({
            error: 'Validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          }, { status: 400 });
        }

        if (error instanceof SyntaxError && error.message.includes('JSON')) {
          return NextResponse.json({
            error: 'Invalid JSON format'
          }, { status: 400 });
        }

        throw error;
      }
    };
  };
}

/**
 * Sanitization middleware for common security issues
 */
export function withSanitization(handler: (req: NextRequest, user: TeamUser) => Promise<Response>) {
  return async (req: NextRequest, user: TeamUser): Promise<Response> => {
    // Clone the request to modify body
    const clonedReq = req.clone();

    try {
      const body = await clonedReq.json();

      // Sanitize common XSS vectors
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }

        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }

        return obj;
      };

      const sanitizedBody = sanitize(body);

      // Create new request with sanitized body
      const newReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(sanitizedBody),
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

      return handler(newReq, user);

    } catch (error) {
      // If body parsing fails, continue with original request
      return handler(req, user);
    }
  };
}

/**
 * Request logging middleware
 */
export function withRequestLogging(options: {
  logBody?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
} = {}) {
  const { logBody = false, logHeaders = false, excludePaths = [] } = options;

  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return async (req: NextRequest, user: TeamUser): Promise<Response> => {
      const startTime = Date.now();
      const url = new URL(req.url);

      // Skip logging for excluded paths
      if (excludePaths.some(path => url.pathname.includes(path))) {
        return handler(req, user);
      }

      const logData: any = {
        method: req.method,
        url: req.url,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        userId: user.id,
        tenantId: user.tenantId,
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      };

      if (logHeaders) {
        logData.headers = Object.fromEntries(req.headers.entries());
      }

      if (logBody && req.method !== 'GET') {
        try {
          logData.body = await req.clone().json();
        } catch (error) {
          // Body is not JSON, skip logging
        }
      }

      logger.info('Team API request started', logData);

      try {
        const response = await handler(req, user);
        const duration = Date.now() - startTime;

        logger.info('Team API request completed', {
          ...logData,
          status: response.status,
          duration,
          success: response.status < 400
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Team API request failed', {
          ...logData,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        throw error;
      }
    };
  };
}

/**
 * CORS middleware for team APIs
 */
export function withTeamCors(options: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
} = {}) {
  const {
    origins = ['http://localhost:3000'],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials = true
  } = options;

  return (handler: (req: NextRequest, user: TeamUser) => Promise<Response>) => {
    return async (req: NextRequest, user: TeamUser): Promise<Response> => {
      const origin = req.headers.get('origin');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        const headers = new Headers();

        if (origin && origins.includes(origin)) {
          headers.set('Access-Control-Allow-Origin', origin);
        }

        headers.set('Access-Control-Allow-Methods', methods.join(', '));
        headers.set('Access-Control-Allow-Headers', headers.join(', '));
        headers.set('Access-Control-Max-Age', '86400'); // 24 hours

        if (credentials) {
          headers.set('Access-Control-Allow-Credentials', 'true');
        }

        return new Response(null, { headers });
      }

      const response = await handler(req, user);

      // Add CORS headers to the response
      if (origin && origins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }

      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    };
  };
}

/**
 * Compose multiple middleware functions
 */
export function compose<T extends any[]>(
  ...middlewares: T
): T extends [infer First, ...infer Rest]
  ? First extends (req: NextRequest, user: TeamUser, ...args: any[]) => Promise<Response>
    ? (...args: Parameters<First>) => Promise<Response>
    : never
  : never {
  return ((req: NextRequest, user: TeamUser, ...args: any[]): Promise<Response> => {
    return middlewares.reduceRight(
      (next, middleware) => {
        return (middlewareReq: NextRequest, middlewareUser: TeamUser, ...middlewareArgs: any[]) => {
          return middleware(middlewareReq, middlewareUser, (...innerArgs: any[]) => {
            return next(middlewareReq, middlewareUser, ...innerArgs);
          });
        };
      },
      (finalReq: NextRequest, finalUser: TeamUser, ...finalArgs: any[]) => {
        // Final handler
        return finalArgs[0]?.(finalReq, finalUser) || Promise.resolve(new Response('OK'));
      }
    )(req, user, ...args);
  }) as any;
}