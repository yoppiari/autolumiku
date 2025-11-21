/**
 * GET /api/v1/commands/history
 * Epic 3: Story 3.3 - Get command history
 *
 * Returns command execution history for a user, paginated and filterable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const intent = searchParams.get('intent'); // Filter by specific intent
    const successOnly = searchParams.get('successOnly') === 'true';

    // Validation
    if (!tenantId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'tenantId and userId are required',
          },
        },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      tenantId,
      userId,
    };

    if (intent) {
      where.intent = intent;
    }

    if (successOnly) {
      where.success = true;
    }

    // Fetch history
    const [history, total] = await Promise.all([
      prisma.commandHistory.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: Math.min(limit, 100), // Max 100 per request
        skip: offset,
        select: {
          id: true,
          originalCommand: true,
          intent: true,
          confidence: true,
          success: true,
          executionTimeMs: true,
          errorMessage: true,
          timestamp: true,
        },
      }),
      prisma.commandHistory.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      history,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + history.length < total,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch command history:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch command history',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');
    const commandId = searchParams.get('commandId'); // Optional: delete specific command

    // Validation
    if (!tenantId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'tenantId and userId are required',
          },
        },
        { status: 400 }
      );
    }

    // Delete specific command or all history
    if (commandId) {
      await prisma.commandHistory.delete({
        where: {
          id: commandId,
          tenantId,
          userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Command deleted from history',
      });
    } else {
      // Delete all history for user
      const result = await prisma.commandHistory.deleteMany({
        where: {
          tenantId,
          userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Command history cleared',
        deletedCount: result.count,
      });
    }
  } catch (error) {
    console.error('Failed to delete command history:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete command history',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
