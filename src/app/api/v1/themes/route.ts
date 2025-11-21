/**
 * Theme Management API
 * Epic 5: Story 5.7, 5.8, 5.9 - Website Themes
 *
 * GET /api/v1/themes - Get all themes
 * POST /api/v1/themes - Create new theme
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { brandingService } from '@/services/catalog/branding.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const themes = await brandingService.getAllThemes(user.tenantId);

    return NextResponse.json({ themes });
  } catch (error: any) {
    console.error('Get themes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch themes', details: error.message },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    const theme = await brandingService.createTheme(user.tenantId, body);

    return NextResponse.json(theme, { status: 201 });
  } catch (error: any) {
    console.error('Create theme error:', error);
    return NextResponse.json(
      { error: 'Failed to create theme', details: error.message },
      { status: 500 }
    );
  }
});
