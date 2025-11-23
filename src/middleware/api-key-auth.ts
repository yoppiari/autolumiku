/**
 * API Key Authentication Middleware
 * Story SC.5: API Security and Integration Protection
 *
 * Validates API keys for third-party integrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/services/api-key-service';

/**
 * Middleware to validate API key from request headers
 *
 * Usage:
 * 1. Client sends request with header: Authorization: Bearer sk_live_xxxxx
 * 2. Middleware validates key and checks permissions
 * 3. If valid, adds tenantId and apiKey to request context
 * 4. If invalid, returns 401 Unauthorized
 */
export async function validateApiKey(
  request: NextRequest,
  requiredPermission?: string
): Promise<NextResponse | { tenantId: string; apiKeyId: string }> {
  // Get API key from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>',
      },
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  // Validate API key
  const validation = await apiKeyService.validateApiKey(apiKey, requiredPermission);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: validation.error || 'Invalid API key',
      },
      { status: 401 }
    );
  }

  // Add rate limit headers
  const response = NextResponse.next();
  if (validation.apiKey) {
    response.headers.set('X-RateLimit-Limit', validation.apiKey.rateLimit.toString());
    response.headers.set('X-RateLimit-Remaining', (validation.remainingQuota || 0).toString());
  }

  // Return tenant context
  return {
    tenantId: validation.apiKey!.tenantId,
    apiKeyId: validation.apiKey!.id,
  };
}

/**
 * Example API route using API key auth:
 *
 * // app/api/v1/public/vehicles/route.ts
 * import { validateApiKey } from '@/middleware/api-key-auth';
 * import { ApiKeyPermission } from '@/services/api-key-service';
 *
 * export async function GET(request: NextRequest) {
 *   // Validate API key with required permission
 *   const auth = await validateApiKey(request, ApiKeyPermission.READ_VEHICLES);
 *
 *   // If validation failed, return error response
 *   if (auth instanceof NextResponse) {
 *     return auth;
 *   }
 *
 *   // Auth successful - use tenantId
 *   const { tenantId } = auth;
 *
 *   // Fetch vehicles for this tenant
 *   const vehicles = await prisma.vehicle.findMany({
 *     where: { tenantId, status: 'AVAILABLE' }
 *   });
 *
 *   return NextResponse.json({ vehicles });
 * }
 */
