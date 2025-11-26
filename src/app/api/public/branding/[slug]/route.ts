/**
 * GET /api/public/branding/[slug] - Get tenant branding
 */

import { NextRequest, NextResponse } from 'next/server';
import { BrandingService } from '@/lib/services/catalog/branding.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const branding = await BrandingService.getBrandingBySlugOrDomain(slug);
    if (!branding) {
      return NextResponse.json(
        { error: 'Showroom not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: branding,
    });
  } catch (error) {
    console.error('Branding API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load branding',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
