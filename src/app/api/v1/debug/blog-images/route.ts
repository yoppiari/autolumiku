/**
 * Debug endpoint to check blog post images
 * GET /api/v1/debug/blog-images?tenantId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      // Get all tenants
      const tenants = await prisma.tenant.findMany({
        select: { id: true, name: true, slug: true }
      });
      return NextResponse.json({ tenants });
    }

    const posts = await prisma.blogPost.findMany({
      where: { tenantId },
      select: {
        id: true,
        title: true,
        featuredImage: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: posts.map(p => ({
        id: p.id,
        title: p.title,
        featuredImage: p.featuredImage,
        hasImage: !!p.featuredImage,
        imageType: p.featuredImage ? (p.featuredImage.startsWith('/uploads/') ? 'local' : p.featuredImage.startsWith('http') ? 'external' : 'unknown') : 'none',
        status: p.status,
      })),
    });
  } catch (error) {
    console.error('Debug blog images error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
