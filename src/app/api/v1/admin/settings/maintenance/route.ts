/**
 * Maintenance Mode API
 * Admin endpoints for controlling platform maintenance mode
 * Part of Story 1.11: Global Platform Settings Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalSettingsService } from '@/services/global-settings-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const maintenanceModeSchema = z.object({
  message: z.string().min(1),
  messageIndonesian: z.string().min(1),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  allowedUsers: z.array(z.string()).optional(),
  reason: z.string().min(1)
});

/**
 * GET /api/v1/admin/settings/maintenance
 * Get current maintenance mode status
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const config = globalSettingsService.getMaintenanceModeConfig();
    const userId = req.headers.get('x-user-id');
    const isActive = globalSettingsService.isMaintenanceModeActive(userId || undefined);

    return NextResponse.json({
      success: true,
      data: {
        config,
        isActive
      }
    });
  } catch (error) {
    console.error('[Maintenance API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get maintenance mode status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/settings/maintenance/enable
 * Enable maintenance mode
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // TODO: Check admin permission
    // const hasPermission = await checkPermission(req, 'settings.maintenance.manage');

    const body = await req.json();
    const validation = maintenanceModeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format', details: validation.error },
        { status: 400 }
      );
    }

    const enabledBy = req.headers.get('x-user-id') || 'admin';

    const config = await globalSettingsService.enableMaintenanceMode({
      ...validation.data,
      scheduledStart: validation.data.scheduledStart ? new Date(validation.data.scheduledStart) : undefined,
      scheduledEnd: validation.data.scheduledEnd ? new Date(validation.data.scheduledEnd) : undefined,
      enabledBy
    });

    return NextResponse.json({
      success: true,
      data: { config }
    });
  } catch (error) {
    console.error('[Maintenance API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to enable maintenance mode' },
      { status: 500 }
    );
  }
}
