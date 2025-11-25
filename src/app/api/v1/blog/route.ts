/**
 * GET /api/v1/blog - List blog posts
 * POST /api/v1/blog - Create blog post
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BlogStatus } from '@prisma/client';

/**
 * GET /api/v1/blog
 * List blog posts for tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get filters
    const status = searchParams.get('status') as BlogStatus | null;
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }

    // Get blog posts with pagination
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          category: true,
          status: true,
          seoScore: true,
          wordCount: true,
          views: true,
          publishedAt: true,
          createdAt: true,
          authorName: true,
          featuredImage: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get blog posts error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get blog posts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/blog
 * Create new blog post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, authorId, authorName, ...postData } = body;

    if (!tenantId || !authorId) {
      return NextResponse.json(
        { error: 'tenantId and authorId are required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['title', 'slug', 'content', 'category'];
    for (const field of requiredFields) {
      if (!postData[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Check if slug already exists for this tenant
    const existingPost = await prisma.blogPost.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: postData.slug,
        },
      },
    });

    if (existingPost) {
      return NextResponse.json(
        { error: 'Slug already exists for this tenant' },
        { status: 400 }
      );
    }

    // Create blog post
    const post = await prisma.blogPost.create({
      data: {
        ...postData,
        tenantId,
        authorId,
        authorName: authorName || 'Admin',
        publishedAt: postData.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: post,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create blog post error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create blog post',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
