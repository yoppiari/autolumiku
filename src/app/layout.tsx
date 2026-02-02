import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

// Use a robust system font stack that prioritizes Inter if available on the system
// but falls back gracefully to high-quality system fonts.
// This prevents build failures in environments with restricted internet (like Docker).
const interFontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

import { prisma } from '@/lib/prisma';

// Force dynamic rendering for the entire app to prevent build-time database access failures.
// This is necessary because the Docker build environment does not have access to the production database.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  let favicon = '/favicon.png';
  let appleIcon = '/favicon-48.png';

  try {
    // Wrap DB operations in a timeout to prevent build hangs
    // This addresses the "Deployment loading..." issue caused by database connectivity blocks
    const fetchTenantWithTimeout = async () => {
      const headersList = headers();
      const tenantSlug = headersList.get('x-tenant-slug');

      // Use a single query to find the best match to minimize round-trips
      const conditions: any[] = [];
      if (tenantSlug) conditions.push({ slug: tenantSlug });
      conditions.push({ id: 'e592973f-9eff-4f40-adf6-ca6b2ad9721f' }); // Admin ID
      conditions.push({ name: { contains: 'Prima Mobil', mode: 'insensitive' } }); // Keyword

      const foundTenants = await prisma.tenant.findMany({
        where: {
          OR: conditions
        },
        select: { id: true, slug: true, name: true, faviconUrl: true },
        take: 3
      });

      // Priority: 1. Exact slug, 2. Admin ID, 3. Name match
      if (tenantSlug) {
        const slugMatch = foundTenants.find(t => t.slug === tenantSlug);
        if (slugMatch) return slugMatch;
      }

      const adminMatch = foundTenants.find(t => t.id === 'e592973f-9eff-4f40-adf6-ca6b2ad9721f');
      if (adminMatch) return adminMatch;

      return foundTenants[0] || null;
    };

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('[Layout] Metadata DB fetch timed out - using defaults');
        resolve(null);
      }, 4000) // Increase to 4 seconds - metadata is heavy on first-load
    );

    // Race to finish
    const tenant = await Promise.race([fetchTenantWithTimeout(), timeoutPromise]);

    if (tenant?.faviconUrl) {
      const isDataUrl = tenant.faviconUrl.startsWith('data:');
      if (isDataUrl) {
        favicon = tenant.faviconUrl;
        appleIcon = tenant.faviconUrl;
      } else {
        const v = new Date().getTime().toString();
        favicon = `${tenant.faviconUrl}?v=${v}`;
        appleIcon = `${tenant.faviconUrl}?v=${v}`;
      }
    }
  } catch (error) {
    console.error('Error fetching tenant metadata:', error);
  }

  return {
    title: 'Prima Mobil Platform',
    description: 'Platform administrasi showroom otomotif',
    icons: {
      icon: favicon,
      apple: appleIcon,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head />
      <body style={{ fontFamily: interFontStack }}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
