/**
 * Showroom Layout
 * Wraps all showroom pages with ThemeProvider and common structure
 */

import React from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  try {
    // Get tenant info from middleware headers
    const headersList = headers();
    const tenantSlug = headersList.get('x-tenant-slug');

    if (!tenantSlug) {
      return {};
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        name: true,
        domain: true,
        slug: true,
        faviconUrl: true,
        logoUrl: true,
      },
    });

    if (!tenant) {
      return {};
    }

    // Get headers to determine domain context
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
    const originalPath = headersList.get('x-original-path') || '';

    // Generate canonical URL based on domain context
    const canonicalUrl = isCustomDomain
      ? `https://${tenant.domain}${originalPath}`
      : `https://auto.lumiku.com/catalog/${tenant.slug}`;

    return {
      title: {
        template: `%s | ${tenant.name}`,
        default: tenant.name,
      },
      description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}. Dapatkan mobil impian Anda dengan harga terbaik.`,
      ...(tenant.faviconUrl && {
        icons: {
          icon: tenant.faviconUrl,
        },
      }),
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: tenant.name,
        description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}`,
        url: canonicalUrl,
        siteName: tenant.name,
        locale: 'id_ID',
        type: 'website',
        images: tenant.logoUrl ? [
          {
            url: tenant.logoUrl,
            width: 1200,
            height: 630,
            alt: tenant.name,
          }
        ] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: tenant.name,
        description: `Jelajahi koleksi kendaraan terlengkap di ${tenant.name}`,
        images: tenant.logoUrl ? [tenant.logoUrl] : [],
      },
    };
  } catch (error) {
    console.error('generateMetadata Error:', error);
    return {};
  }
}

import WhatsAppFloatingButton from '@/components/catalog/WhatsAppFloatingButton';

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

  // Get tenant data for WhatsApp
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId || '' },
    select: { name: true, whatsappNumber: true, logoUrl: true }
  });

  return (
    <ThemeProvider tenantId={tenantId || ''}>
      {children}
      {tenant?.whatsappNumber && (
        <WhatsAppFloatingButton
          phoneNumber={tenant.whatsappNumber}
          tenantName={tenant.name || 'Showroom'}
          logoUrl={tenant.logoUrl}
        />
      )}
    </ThemeProvider>
  );
}
