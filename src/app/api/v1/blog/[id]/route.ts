/**
 * GET /api/v1/blog/[id] - Get single blog post
 * PUT /api/v1/blog/[id] - Update blog post
 * DELETE /api/v1/blog/[id] - Delete blog post
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/v1/blog/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // Increment views
    await prisma.blogPost.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('Get blog post error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get blog post',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/blog/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();

    // Check if post exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // If slug is being changed, check uniqueness
    if (body.slug && body.slug !== existingPost.slug) {
      const slugExists = await prisma.blogPost.findUnique({
        where: {
          tenantId_slug: {
            tenantId: existingPost.tenantId,
            slug: body.slug,
          },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Slug already exists for this tenant' },
          { status: 400 }
        );
      }
    }

    // Update publishedAt if status changes to PUBLISHED
    if (body.status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED') {
      body.publishedAt = new Date();
    }

    // Update blog post
    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: updatedPost,
    });
  } catch (error) {
    console.error('Update blog post error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update blog post',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/blog/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Check if post exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // Delete blog post
    await prisma.blogPost.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted successfully',
    });
  } catch (error) {
    console.error('Delete blog post error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete blog post',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
