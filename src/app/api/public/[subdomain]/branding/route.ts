/**
 * Public Branding API
 * Epic 5: Story 5.2 - Tenant Branding & Theming
 *
 * GET /api/public/[subdomain]/branding - Get tenant branding and theme
 */

import { NextRequest, NextResponse } from 'next/server';
import { brandingService } from '@/services/catalog/branding.service';
import { seoService } from '@/services/catalog/seo.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    // Get branding by subdomain or custom domain
    let branding = await brandingService.getBrandingBySubdomain(subdomain);

    if (!branding) {
      // Try custom domain
      branding = await brandingService.getBrandingByCustomDomain(subdomain);
    }

    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    // Get active theme
    const theme = await brandingService.getActiveTheme(branding.tenantId);

    // Generate CSS variables
    const cssVariables = brandingService.generateCSSVariables(branding);

    // Generate business structured data
    const structuredData = seoService.generateBusinessStructuredData(branding);

    // Generate catalog SEO metadata
    const baseUrl = branding.customDomain
      ? `https://${branding.customDomain}`
      : `https://${branding.subdomain}.autolumiku.com`;

    const seoMetadata = seoService.generateCatalogMetadata(branding, baseUrl);

    return NextResponse.json(
      {
        branding: {
          // Business info
          businessName: branding.businessName,
          tagline: branding.tagline,
          description: branding.description,

          // Contact
          email: branding.email,
          phone: branding.phone,
          whatsappNumber: branding.whatsappNumber,
          address: branding.address,
          city: branding.city,
          province: branding.province,
          postalCode: branding.postalCode,

          // Location
          latitude: branding.latitude,
          longitude: branding.longitude,
          mapUrl: branding.mapUrl,

          // Assets
          logoUrl: branding.logoUrl,
          faviconUrl: branding.faviconUrl,
          coverImageUrl: branding.coverImageUrl,

          // Colors
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          accentColor: branding.accentColor,
          fontFamily: branding.fontFamily,

          // Social media
          facebookUrl: branding.facebookUrl,
          instagramUrl: branding.instagramUrl,
          tiktokUrl: branding.tiktokUrl,
          youtubeUrl: branding.youtubeUrl,

          // Domain
          customDomain: branding.customDomain,
          subdomain: branding.subdomain,
        },
        theme,
        cssVariables,
        seo: seoMetadata,
        structuredData,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error: any) {
    console.error('Public branding error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding', details: error.message },
      { status: 500 }
    );
  }
}
