/**
 * POST /api/v1/commands/parse
 * Epic 3: Story 3.1 - Parse natural language command
 *
 * Parses Indonesian natural language commands into structured intents and entities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { commandParser } from '@/services/nl-command-service/command-parser';
import { intentRecognizer } from '@/services/nl-command-service/intent-recognizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, tenantId, userId } = body;

    // Validation
    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_COMMAND',
            message: 'Command text is required and must be a string',
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

    // Parse command using rule-based parser
    const parsedCommand = commandParser.parse(command);

    // Enhance with AI if confidence is low or ambiguous
    if (parsedCommand.confidence < 0.7 || parsedCommand.needsClarification) {
      try {
        const aiResult = await intentRecognizer.recognizeIntent(
          command,
          parsedCommand.intent
        );

        // Update with AI results if confidence improved
        if (aiResult.confidence > parsedCommand.confidence) {
          parsedCommand.intent = aiResult.intent;
          parsedCommand.confidence = aiResult.confidence;
          parsedCommand.metadata = {
            ...parsedCommand.metadata,
            aiEnhanced: true,
            aiReasoning: aiResult.reasoning,
          };

          // If AI is confident, remove clarification flag
          if (aiResult.confidence >= 0.8) {
            parsedCommand.needsClarification = false;
            parsedCommand.clarificationQuestions = [];
          }
        }
      } catch (aiError) {
        console.error('AI intent recognition failed:', aiError);
        // Continue with rule-based results
      }
    }

    // Return parsed command
    return NextResponse.json({
      success: true,
      parsedCommand,
      metadata: {
        parsingTime: Date.now(),
        enhanced: parsedCommand.metadata?.aiEnhanced || false,
      },
    });
  } catch (error) {
    console.error('Command parsing error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PARSING_ERROR',
          message: 'Failed to parse command',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
