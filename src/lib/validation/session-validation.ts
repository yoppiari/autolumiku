/**
 * Session API Validation Schemas
 * Using Zod for type-safe validation
 */

import { z } from 'zod';

/**
 * JWT token format validation
 * Basic format: header.payload.signature
 */
const jwtTokenSchema = z.string()
  .min(10)
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, {
    message: 'Invalid token format'
  });

/**
 * Refresh token request validation
 */
export const refreshTokenSchema = z.object({
  refreshToken: jwtTokenSchema
});

/**
 * Session revocation request validation
 */
export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid({
    message: 'Invalid session ID format'
  })
});

/**
 * Device info validation
 */
export const deviceInfoSchema = z.object({
  userAgent: z.string().optional(),
  ipAddress: z.string().ip().optional()
});

/**
 * Session query parameters validation
 */
export const sessionQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  includeInactive: z.enum(['true', 'false']).optional().transform(val => val === 'true')
});

/**
 * Generic validation helper
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || 'Invalid request data'
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}
