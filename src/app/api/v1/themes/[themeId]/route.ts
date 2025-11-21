/**
 * Theme Management API
 * Epic 5: Story 5.7, 5.8, 5.9 - Theme CRUD
 *
 * PUT /api/v1/themes/[themeId] - Update theme
 * DELETE /api/v1/themes/[themeId] - Delete theme
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { brandingService } from '@/services/catalog/branding.service';
import { prisma } from '@/lib/prisma';

export const PUT = withAuth(
  async (request, { user, params }: { user: any; params: { themeId: string } }) => {
    try {
      const { themeId } = params;
      const body = await request.json();

      // Verify theme belongs to tenant
      const theme = await prisma.websiteTheme.findUnique({
        where: { id: themeId },
      });

      if (!theme || theme.tenantId !== user.tenantId) {
        return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      }

      const updatedTheme = await brandingService.updateTheme(themeId, body);

      return NextResponse.json(updatedTheme);
    } catch (error: any) {
      console.error('Update theme error:', error);
      return NextResponse.json(
        { error: 'Failed to update theme', details: error.message },
        { status: 500 }
      );
    }
  }
);

export const DELETE = withAuth(
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

      // Don't allow deleting active theme
      if (theme.isActive) {
        return NextResponse.json(
          { error: 'Cannot delete active theme' },
          { status: 400 }
        );
      }

      await prisma.websiteTheme.delete({
        where: { id: themeId },
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('Delete theme error:', error);
      return NextResponse.json(
        { error: 'Failed to delete theme', details: error.message },
        { status: 500 }
      );
    }
  }
);
