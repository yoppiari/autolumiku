/**
 * Theme Activation API
 * Epic 5: Story 5.7 - Theme Switching
 *
 * POST /api/v1/themes/[themeId]/activate - Activate theme
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { brandingService } from '@/services/catalog/branding.service';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(
  async (request, { user, params }: { user: any; params: { themeId: string } }) => {
    try {
      const { themeId } = params;

      // Verify theme belongs to tenant
      const theme = await prisma.websiteTheme.findUnique({
        where: { id: themeId },
      });

      if (!theme || theme.tenantId !== user.tenantId) {
        return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      }

      const activatedTheme = await brandingService.activateTheme(
        themeId,
        user.tenantId
      );

      return NextResponse.json(activatedTheme);
    } catch (error: any) {
      console.error('Activate theme error:', error);
      return NextResponse.json(
        { error: 'Failed to activate theme', details: error.message },
        { status: 500 }
      );
    }
  }
);
