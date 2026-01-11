/**
 * Login Page
 * Epic 1: User Authentication UI
 *
 * Server component wrapper to fetch branding data and prevent logo flicker on refresh
 */

import { headers } from 'next/headers';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import { LoginForm } from './login-form';

// Domain to slug mapping (same as middleware)
const domainToSlug: Record<string, string> = {
  'primamobil.id': 'primamobil-id',
  'www.primamobil.id': 'primamobil-id',
};

async function getTenantBranding() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const cleanHost = host.split(':')[0]; // Remove port

  console.log('[Login Page] Host:', cleanHost);

  // Check if this is a known custom domain
  const tenantSlug = domainToSlug[cleanHost];

  let tenant = null;
  let branding = null;

  if (tenantSlug) {
    // Custom domain - lookup by slug
    console.log('[Login Page] Custom domain detected, slug:', tenantSlug);

    tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { slug: tenantSlug.replace(/-id$/, '') }, // Fallback without -id suffix
        ],
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });

    if (tenant) {
      branding = await BrandingService.getBrandingBySlugOrDomain(tenant.slug);
    }
  } else {
    // Try lookup by domain directly
    console.log('[Login Page] Looking up by domain:', cleanHost);

    tenant = await prisma.tenant.findFirst({
      where: {
        domain: cleanHost,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });

    if (tenant) {
      branding = await BrandingService.getBrandingBySlugOrDomain(tenant.slug);
    }
  }

  if (!tenant) {
    console.log('[Login Page] No tenant found for host:', cleanHost);
    return {
      name: 'AutoLumiKu',
      logoUrl: undefined,
      primaryColor: '#2563eb',
    };
  }

  console.log('[Login Page] Found tenant:', tenant.name);

  return {
    name: branding?.name || tenant?.name || 'AutoLumiKu',
    logoUrl: branding?.logoUrl || tenant?.logoUrl,
    primaryColor: branding?.primaryColor || tenant?.primaryColor || '#2563eb',
  };
}

export default async function LoginPage() {
  // Fetch branding server-side to prevent flicker
  const branding = await getTenantBranding();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={
          <div className="w-full max-w-md bg-[#2a2a2a] border-[#333] rounded-lg p-6">
            <div className="flex justify-center mb-4">
              <div className="text-4xl font-bold text-white">Loading...</div>
            </div>
          </div>
        }>
          <LoginForm initialBranding={branding} />
        </Suspense>
      </div>
    </div>
  );
}
