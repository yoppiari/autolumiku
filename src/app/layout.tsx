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
    // 1. Try to get tenant from Headers (Standard Showroom Logic)
    // This allows primamobil.id to work natively like the working Contact Page
    const headersList = headers();
    const tenantSlug = headersList.get('x-tenant-slug');

    let tenant = null;
    if (tenantSlug) {
      tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { faviconUrl: true }
      });
    }

    // 2. Fallback: If no header (Admin Panel), use the Correct ID provided by User
    if (!tenant) {
      tenant = await prisma.tenant.findUnique({
        where: { id: 'e592973f-9eff-4f40-adf6-ca6b2ad9721f' },
        select: { faviconUrl: true, id: true, slug: true }
      });
    }

    // 3. Last Resort: Search by Name (Legacy)
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { name: { contains: 'Prima Mobil', mode: 'insensitive' } },
            { slug: 'prima-mobil' }
          ]
        },
        select: { faviconUrl: true, id: true, slug: true } // Added id and slug for the new logic
      });
    }

    if (tenant?.faviconUrl) {
      // Use the stored icon (could be data URL or remote link)
      const isDataUrl = tenant.faviconUrl.startsWith('data:');

      if (isDataUrl) {
        favicon = tenant.faviconUrl;
        appleIcon = tenant.faviconUrl;
      } else {
        // Only add version tag for remote URLs to force cache refresh
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