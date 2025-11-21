import { NextRequest, NextResponse } from 'next/server';
import { progressTracker } from '@/services/onboarding-service/progress/tracker';
import { SaveProgressRequest } from '@/types/onboarding';

/**
 * Onboarding Progress API
 *
 * GET /api/onboarding/progress?id={onboardingId} - Get progress state
 * POST /api/onboarding/progress - Save progress data
 * PUT /api/onboarding/progress/complete - Complete onboarding
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const onboardingId = searchParams.get('id');

    if (!onboardingId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    // Get progress state
    const progress = await progressTracker.getProgress(onboardingId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Progress not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Error getting progress:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveProgressRequest = await request.json();
    const { onboardingId, step, data } = body;

    // Validate required fields
    if (!onboardingId || !step) {
      return NextResponse.json(
        { error: 'Missing required fields: onboardingId, step' },
        { status: 400 }
      );
    }

    // Save progress data
    await progressTracker.updateStepProgress(onboardingId, step, data);

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully'
    });

  } catch (error) {
    console.error('Error saving progress:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}