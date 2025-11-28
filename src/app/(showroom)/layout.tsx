/**
 * Showroom Layout
 * Wraps all showroom pages with ThemeProvider and common structure
 */

import React from 'react';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { BrandingService } from '@/lib/services/catalog/branding.service';

export default async function ShowroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get tenant info from middleware headers
  const headersList = headers();
  const tenantSlug = headersList.get('x-tenant-slug');
  const tenantId = headersList.get('x-tenant-id');

  // If no tenant detected, render children without theme
  if (!tenantSlug) {
    return <>{children}</>;
  }

  // Get tenant branding
  const branding = await BrandingService.getBrandingBySlugOrDomain(tenantSlug);

  // If branding not found, render without theme
  if (!branding) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider tenantId={tenantId || ''}>
      {children}
    </ThemeProvider>
  );
}
