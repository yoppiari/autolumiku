/**
 * GET/POST /api/v1/message-templates
 * Message template management
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const where: any = { tenantId };

    if (category) {
      where.category = category;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get templates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      name,
      category,
      subject,
      content,
      variables,
      isActive,
      createdBy,
    } = body;

    if (!tenantId || !name || !content || !createdBy) {
      return NextResponse.json(
        { error: 'tenantId, name, content, and createdBy are required' },
        { status: 400 }
      );
    }

    const template = await prisma.messageTemplate.create({
      data: {
        tenantId,
        name,
        category: category || 'custom',
        subject,
        content,
        variables: variables || [],
        isActive: isActive !== undefined ? isActive : true,
        createdBy,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create template',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
