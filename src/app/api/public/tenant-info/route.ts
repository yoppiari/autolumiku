/**
 * Public Tenant Info API
 * Returns tenant data from middleware headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFullTenant, getTenantBranding } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get tenant and branding using helper functions
    // These use x-tenant-domain header set by middleware
    const [tenant, branding] = await Promise.all([
      getFullTenant(),
      getTenantBranding(),
    ]);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tenant,
      branding,
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
