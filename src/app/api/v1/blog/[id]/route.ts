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
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    // ✅ SECURITY: Verify tenant ownership if tenantId provided
    const where: any = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const post = await prisma.blogPost.findUnique({
      where,
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
    const { tenantId, ...updateData } = body;

    // ✅ SECURITY: Require tenantId for update operations
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Check if post exists and belongs to tenant
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // ✅ SECURITY: Verify tenant ownership
    if (existingPost.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: Blog post belongs to different tenant' },
        { status: 403 }
      );
    }

    // If slug is being changed, check uniqueness
    if (updateData.slug && updateData.slug !== existingPost.slug) {
      const slugExists = await prisma.blogPost.findUnique({
        where: {
          tenantId_slug: {
            tenantId: existingPost.tenantId,
            slug: updateData.slug,
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
    if (updateData.status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }

    // Update blog post
    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: updateData,
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
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    // ✅ SECURITY: Require tenantId for delete operations
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

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

    // ✅ SECURITY: Verify tenant ownership
    if (existingPost.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: Blog post belongs to different tenant' },
        { status: 403 }
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
