/**
 * Global Platform Settings API
 * Admin-only endpoints for platform configuration
 * Part of Story 1.11: Global Platform Settings Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalSettingsService, SettingCategory, SettingScope } from '@/services/global-settings-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  category: z.nativeEnum(SettingCategory),
  description: z.string().optional(),
  reason: z.string().optional()
});

const bulkUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string(),
    value: z.any(),
    category: z.nativeEnum(SettingCategory)
  }))
});

/**
 * GET /api/v1/admin/settings
 * Get all global settings or by category
 */
export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // TODO: Check admin permission
    // const hasPermission = await checkPermission(req, 'settings.view');
    // if (!hasPermission) {
    //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    // }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as SettingCategory | null;
    const scope = searchParams.get('scope') as SettingScope | null;

    let settings;

    if (category) {
      settings = await globalSettingsService.getSettingsByCategory(category);
    } else if (scope) {
      settings = await globalSettingsService.exportSettings(scope);
    } else {
      settings = await globalSettingsService.exportSettings();
    }

    return NextResponse.json({
      success: true,
      data: {
        settings,
        count: settings.length
      }
    });
  } catch (error) {
    console.error('[Settings API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/settings
 * Create or update a global setting
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // TODO: Check admin permission
    // const hasPermission = await checkPermission(req, 'settings.update');
    // if (!hasPermission) {
    //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    // }

    const body = await req.json();
    const validation = updateSettingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format', details: validation.error },
        { status: 400 }
      );
    }

    const { key, value, category, description, reason } = validation.data;

    // Get user ID from auth token (mock for now)
    const updatedBy = req.headers.get('x-user-id') || 'admin';

    const setting = await globalSettingsService.setGlobalSetting(key, value, {
      category,
      description,
      updatedBy,
      reason
    });

    return NextResponse.json({
      success: true,
      data: { setting }
    });
  } catch (error) {
    console.error('[Settings API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/settings/bulk
 * Bulk update multiple settings
 */
export async function PUT(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = bulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const updatedBy = req.headers.get('x-user-id') || 'admin';

    const settings = await globalSettingsService.bulkUpdateSettings(
      validation.data.settings,
      updatedBy
    );

    return NextResponse.json({
      success: true,
      data: {
        settings,
        count: settings.length
      }
    });
  } catch (error) {
    console.error('[Settings API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update settings' },
      { status: 500 }
    );
  }
}
