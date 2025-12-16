/**
 * Fix Blog Images API
 * GET /api/v1/setup/fix-blog-images
 * Clears invalid featuredImage URLs from blog posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all blog posts with featuredImage
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        featuredImage: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        featuredImage: true,
      },
    });

    const results: { id: string; title: string; oldImage: string; status: string }[] = [];

    for (const post of blogPosts) {
      if (!post.featuredImage) continue;

      // Check if image URL is valid (starts with / or http)
      const isValidUrl = post.featuredImage.startsWith('/') || post.featuredImage.startsWith('http');

      if (!isValidUrl) {
        // Invalid URL format - clear it
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { featuredImage: null },
        });
        results.push({
          id: post.id,
          title: post.title,
          oldImage: post.featuredImage,
          status: 'cleared - invalid URL format',
        });
        continue;
      }

      // For local uploads, check if file might exist
      // We can't check file existence from API, but we know /uploads/blog/ files are missing
      if (post.featuredImage.startsWith('/uploads/blog/')) {
        // Clear the broken blog image URLs
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { featuredImage: null },
        });
        results.push({
          id: post.id,
          title: post.title,
          oldImage: post.featuredImage,
          status: 'cleared - blog image file not found',
        });
      } else {
        results.push({
          id: post.id,
          title: post.title,
          oldImage: post.featuredImage,
          status: 'kept - external or other URL',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${blogPosts.length} blog posts`,
      results,
    });
  } catch (error) {
    console.error('Fix blog images error:', error);
    return NextResponse.json(
      { error: 'Failed to fix blog images', message: String(error) },
      { status: 500 }
    );
  }
}
