import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

// Use a robust system font stack that prioritizes Inter if available on the system
// but falls back gracefully to high-quality system fonts.
// This prevents build failures in environments with restricted internet (like Docker).
const interFontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  let favicon = '/favicon.png';
  let appleIcon = '/favicon-48.png';

  try {
    // Fetch Prima Mobil tenant branding
    // Prioritize the Known Correct ID from admin dashboard to avoid picking up test/duplicate tenants
    let tenant = await prisma.tenant.findUnique({
      where: { id: 'e592973f-9eff-4f40-adf6-ca6b2ad9721f' },
      select: { faviconUrl: true }
    });

    // Fallback: search by name/slug if specific ID fails
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { name: { contains: 'Prima Mobil', mode: 'insensitive' } },
            { slug: 'prima-mobil' }
          ]
        },
        select: { faviconUrl: true }
      });
    }

    if (tenant?.faviconUrl) {
      // Add version tag to force cache refresh
      const v = new Date().getTime().toString().substring(0, 5);

      // FORCE OVERRIDE: Use the local file which is known to be correct (P Logo with lines)
      // The DB URL might be pointing to a processed/incorrect version
      if (tenant.id === 'e592973f-9eff-4f40-adf6-ca6b2ad9721f') {
        const localPath = '/uploads/tenants/primamobil/brand-logo.png';
        favicon = `${localPath}?v=${v}`;
        appleIcon = `${localPath}?v=${v}`;
      } else {
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