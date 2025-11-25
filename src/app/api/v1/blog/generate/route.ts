/**
 * POST /api/v1/blog/generate
 * AI-powered blog post generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { blogAIService, BlogCategory, BlogTone } from '@/lib/ai/blog-ai-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      category,
      topic,
      tone,
      targetLocation,
      tenantId,
      includeVehicles,
      vehicleIds,
    } = body;

    // Validate required fields
    if (!category || !topic || !tone || !targetLocation) {
      return NextResponse.json(
        { error: 'category, topic, tone, and targetLocation are required' },
        { status: 400 }
      );
    }

    // Get tenant info for context
    let tenantName = 'Showroom Kami';
    let tenantAreas: string[] = [];

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      if (tenant) {
        tenantName = tenant.name;
      }

      // TODO: Get tenant areas from tenant_branding or settings
      // For now, use targetLocation as default area
      tenantAreas = [targetLocation];
    }

    // Generate blog post with AI
    const result = await blogAIService.generateBlogPost({
      category: category as BlogCategory,
      topic,
      tone: tone as BlogTone,
      targetLocation,
      tenantName,
      tenantAreas,
      includeVehicles,
      vehicleIds,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Blog generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate blog post',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
