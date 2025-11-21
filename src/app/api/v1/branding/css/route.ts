/**
 * CSS Variables API
 * Epic 5: Story 5.2 - Dynamic CSS Generation
 *
 * GET /api/v1/branding/css - Get CSS variables from branding
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { brandingService } from '@/services/catalog/branding.service';

export const GET = withAuth(async (request, { user }) => {
  try {
    const branding = await brandingService.getOrCreateBranding(
      user.tenantId,
      `tenant-${user.tenantId.slice(0, 8)}`
    );

    const cssVariables = brandingService.generateCSSVariables(branding);

    return new NextResponse(cssVariables, {
      headers: {
        'Content-Type': 'text/css',
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error: any) {
    console.error('CSS generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSS', details: error.message },
      { status: 500 }
    );
  }
});
