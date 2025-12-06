/**
 * GET/PUT /api/v1/catalog/theme
 * Theme selection and preview API
 */

import { NextRequest, NextResponse } from 'next/server';
import { ThemeService } from '@/lib/services/catalog/theme.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const action = searchParams.get('action'); // 'current', 'all', 'preview'
    const themeId = searchParams.get('themeId');

    // Get all available themes
    if (action === 'all') {
      const themes = ThemeService.getAllThemes();
      return NextResponse.json({
        success: true,
        data: themes,
      });
    }

    // Preview a theme
    if (action === 'preview' && themeId) {
      const preview = ThemeService.previewTheme(themeId);
      return NextResponse.json({
        success: true,
        data: preview,
      });
    }

    // Get current theme for tenant
    if (tenantId) {
      const selectedThemeId = await ThemeService.getSelectedTheme(tenantId);
      const theme = ThemeService.getThemeDefinition(selectedThemeId);
      const cssLight = ThemeService.generateThemeCSS(selectedThemeId, 'light');
      const cssDark = theme.colors.dark
        ? ThemeService.generateThemeCSS(selectedThemeId, 'dark')
        : undefined;

      return NextResponse.json({
        success: true,
        data: {
          selectedThemeId,
          theme,
          cssLight,
          cssDark,
        },
      });
    }

    return NextResponse.json(
      { error: 'tenantId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get theme error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get theme',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, themeId } = body;

    if (!tenantId || !themeId) {
      return NextResponse.json(
        { error: 'tenantId and themeId are required' },
        { status: 400 }
      );
    }

    await ThemeService.setTheme(tenantId, themeId);

    const theme = ThemeService.getThemeDefinition(themeId);
    const cssLight = ThemeService.generateThemeCSS(themeId, 'light');
    const cssDark = theme.colors.dark
      ? ThemeService.generateThemeCSS(themeId, 'dark')
      : undefined;

    return NextResponse.json({
      success: true,
      data: {
        selectedThemeId: themeId,
        theme,
        cssLight,
        cssDark,
      },
    });
  } catch (error) {
    console.error('Update theme error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update theme',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
