/**
 * Public Sitemap API
 * Epic 5: Story 5.3 - SEO Optimization
 *
 * GET /api/public/[subdomain]/sitemap.xml - Generate XML sitemap
 */

import { NextRequest, NextResponse } from 'next/server';
import { catalogEngineService } from '@/services/catalog/catalog-engine.service';
import { brandingService } from '@/services/catalog/branding.service';
import { seoService } from '@/services/catalog/seo.service';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { subdomain: string } }
) {
  try {
    const { subdomain } = params;

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return new NextResponse('Showroom not found', { status: 404 });
    }

    const baseUrl = branding.customDomain
      ? `https://${branding.customDomain}`
      : `https://${branding.subdomain}.autolumiku.com`;

    // Get all available vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: branding.tenantId,
        status: 'AVAILABLE',
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${seoService.generateSitemapEntry(baseUrl, new Date(), 'daily', 1.0)}
  ${seoService.generateSitemapEntry(`${baseUrl}/vehicles`, new Date(), 'hourly', 0.9)}
  ${seoService.generateSitemapEntry(`${baseUrl}/contact`, new Date(), 'monthly', 0.7)}
`;

    // Add vehicle pages
    vehicles.forEach((vehicle) => {
      sitemap += seoService.generateSitemapEntry(
        `${baseUrl}/vehicles/${vehicle.id}`,
        vehicle.updatedAt,
        'weekly',
        0.8
      );
    });

    sitemap += `</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('Sitemap generation error:', error);
    return new NextResponse('Failed to generate sitemap', { status: 500 });
  }
}
