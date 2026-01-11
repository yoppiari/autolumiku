import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

// Use a robust system font stack that prioritizes Inter if available on the system
// but falls back gracefully to high-quality system fonts.
// This prevents build failures in environments with restricted internet (like Docker).
const interFontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export const metadata: Metadata = {
  title: 'Prima Mobil Platform',
  description: 'Platform administrasi showroom otomotif',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon-48.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-48.png" sizes="48x48" />
        <link rel="apple-touch-icon" href="/favicon-48.png" />
      </head>
      <body style={{ fontFamily: interFontStack }}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}