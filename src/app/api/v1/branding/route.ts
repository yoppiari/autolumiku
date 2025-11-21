/**
 * Branding Management API
 * Epic 5: Story 5.2 - Tenant Branding Configuration
 *
 * GET /api/v1/branding - Get tenant branding
 * PUT /api/v1/branding - Update tenant branding
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

    return NextResponse.json(branding);
  } catch (error: any) {
    console.error('Get branding error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding', details: error.message },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();

    // Validate subdomain availability if changing
    if (body.subdomain) {
      const isAvailable = await brandingService.isSubdomainAvailable(
        body.subdomain,
        user.tenantId
      );

      if (!isAvailable) {
        return NextResponse.json(
          { error: 'Subdomain is already taken' },
          { status: 400 }
        );
      }
    }

    // Validate custom domain availability if changing
    if (body.customDomain) {
      const isAvailable = await brandingService.isCustomDomainAvailable(
        body.customDomain,
        user.tenantId
      );

      if (!isAvailable) {
        return NextResponse.json(
          { error: 'Custom domain is already taken' },
          { status: 400 }
        );
      }
    }

    const updatedBranding = await brandingService.updateBranding(
      user.tenantId,
      body
    );

    return NextResponse.json(updatedBranding);
  } catch (error: any) {
    console.error('Update branding error:', error);
    return NextResponse.json(
      { error: 'Failed to update branding', details: error.message },
      { status: 500 }
    );
  }
});
