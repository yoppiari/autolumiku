import { NextRequest, NextResponse } from 'next/server';
import { onboardingService } from '@/services/onboarding-service';
import { GetSuggestionsRequest } from '@/types/onboarding';

/**
 * Onboarding Suggestions API
 *
 * POST /api/onboarding/suggestions - Get smart suggestions for step input
 */

export async function POST(request: NextRequest) {
  try {
    const body: GetSuggestionsRequest = await request.json();
    const { step, input, context } = body;

    // Validate required fields
    if (!step || input === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: step, input' },
        { status: 400 }
      );
    }

    // Get suggestions
    const suggestions = await onboardingService.getSuggestions(step, input);

    return NextResponse.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Error getting suggestions:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}