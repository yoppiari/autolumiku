/**
 * POST /api/v1/vehicles/ai-identify
 *
 * AI-powered vehicle identification from user description
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleAIService } from '@/lib/ai/vehicle-ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userDescription } = body;

    if (!userDescription || typeof userDescription !== 'string') {
      return NextResponse.json(
        { error: 'userDescription is required and must be a string' },
        { status: 400 }
      );
    }

    // Use text-based identification only
    const result = await vehicleAIService.identifyFromText({
      userDescription,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('AI identification error:', error);

    return NextResponse.json(
      {
        error: 'Failed to identify vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
