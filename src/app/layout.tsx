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
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: 'Prima Mobil', mode: 'insensitive' } },
          { slug: 'prima-mobil' }
        ]
      },
      select: { faviconUrl: true }
    });

    if (tenant?.faviconUrl) {
      favicon = tenant.faviconUrl;
      appleIcon = tenant.faviconUrl; // Use same for apple if branded, or keep default
    }
  } catch (error) {
    console.error('Error fetching tenant metadata:', error);
  }

  return {
    title: 'Prima Mobil Platform',
    description: 'Platform administrasi showroom otomotif',
    icons: {
      icon: '/favicon.png', // Force use of local P logo (favicon.png) to ensure correct icon and size
      apple: '/favicon-48.png',
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