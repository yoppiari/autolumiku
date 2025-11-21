/**
 * POST /api/v1/commands/execute
 * Epic 3: Story 3.1 - Execute parsed command
 *
 * Executes a parsed command and returns the result.
 * Tracks execution for learning engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { commandExecutor } from '@/services/nl-command-service/command-executor';
import { learningEngine } from '@/services/nl-command-service/learning-engine';
import { ParsedCommand } from '@/services/nl-command-service/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { parsedCommand, tenantId, userId, context } = body;

    // Validation
    if (!parsedCommand || typeof parsedCommand !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARSED_COMMAND',
            message: 'parsedCommand object is required',
          },
        },
        { status: 400 }
      );
    }

    if (!tenantId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CONTEXT',
            message: 'tenantId and userId are required',
          },
        },
        { status: 400 }
      );
    }

    // Execute command
    const result = await commandExecutor.execute({
      parsedCommand: parsedCommand as ParsedCommand,
      tenantId,
      userId,
      context: context || {},
    });

    const executionTime = Date.now() - startTime;

    // Track execution for learning (async, don't wait)
    learningEngine
      .trackCommandExecution(
        tenantId,
        userId,
        parsedCommand as ParsedCommand,
        result.success,
        executionTime,
        context
      )
      .catch(err => {
        console.error('Failed to track command execution:', err);
      });

    // Return result
    return NextResponse.json({
      success: true,
      result,
      metadata: {
        executionTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Command execution error:', error);

    const executionTime = Date.now() - startTime;

    // Track failed execution
    const { parsedCommand, tenantId, userId, context } = await request
      .json()
      .catch(() => ({}));

    if (parsedCommand && tenantId && userId) {
      learningEngine
        .trackCommandExecution(
          tenantId,
          userId,
          parsedCommand,
          false,
          executionTime,
          context
        )
        .catch(err => {
          console.error('Failed to track failed execution:', err);
        });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Failed to execute command',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
