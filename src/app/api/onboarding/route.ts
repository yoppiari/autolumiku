import { NextRequest, NextResponse } from 'next/server';
import { onboardingService } from '@/services/onboarding-service';
import { InitializeOnboardingRequest, OnboardingError } from '@/types/onboarding';

/**
 * Onboarding API endpoints
 *
 * POST /api/onboarding - Initialize new onboarding
 * GET /api/onboarding/[id] - Get onboarding state
 * PUT /api/onboarding/[id] - Update onboarding state
 */

export async function POST(request: NextRequest) {
  try {
    const body: InitializeOnboardingRequest = await request.json();
    const { tenantId, userId, config } = body;

    // Validate required fields
    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, userId' },
        { status: 400 }
      );
    }

    // Initialize onboarding
    const onboardingState = await onboardingService.initializeOnboarding(tenantId, userId, config);

    return NextResponse.json({
      success: true,
      data: onboardingState
    });

  } catch (error) {
    console.error('Error initializing onboarding:', error);

    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const onboardingId = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!onboardingId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required query parameters: id, tenantId' },
        { status: 400 }
      );
    }

    // Get onboarding state
    const state = await onboardingService.getOnboardingState(onboardingId, tenantId);

    if (!state) {
      return NextResponse.json(
        { error: 'Onboarding not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: state
    });

  } catch (error) {
    console.error('Error getting onboarding state:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}