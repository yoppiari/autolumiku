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
    // STRICT: Use the ID provided by user. Do not guess.
    let tenant = await prisma.tenant.findUnique({
      where: { id: 'e592973f-9eff-4f40-adf6-ca6b2ad9721f' },
      select: { faviconUrl: true }
    });

    // Fallback only if the specific ID doesn't exist (e.g. different environment)
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
      // Add version tag to force cache refresh. This is critical as user reported stale icons.
      const v = new Date().getTime().toString();
      favicon = `${tenant.faviconUrl}?v=${v}`;
      appleIcon = `${tenant.faviconUrl}?v=${v}`;
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