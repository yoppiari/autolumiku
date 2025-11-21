/**
 * Public Robots.txt API
 * Epic 5: Story 5.3 - SEO Optimization
 *
 * GET /api/public/[subdomain]/robots.txt - Generate robots.txt
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

    // Resolve tenant from subdomain
    const branding = await brandingService.getBrandingBySubdomain(subdomain);
    if (!branding) {
      return new NextResponse('Showroom not found', { status: 404 });
    }

    const baseUrl = branding.customDomain
      ? `https://${branding.customDomain}`
      : `https://${branding.subdomain}.autolumiku.com`;

    const robotsTxt = seoService.generateRobotsTxt(baseUrl);

    return new NextResponse(robotsTxt, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  } catch (error: any) {
    console.error('Robots.txt generation error:', error);
    return new NextResponse('Failed to generate robots.txt', { status: 500 });
  }
}
