import { NextRequest, NextResponse } from 'next/server';
import { onboardingService } from '@/services/onboarding-service';
import { StepNavigationRequest, OnboardingError, OnboardingStep } from '@/types/onboarding';

/**
 * Onboarding Navigation API
 *
 * POST /api/onboarding/navigate - Navigate between steps
 */

export async function POST(request: NextRequest) {
  try {
    const body: StepNavigationRequest = await request.json();
    const { onboardingId, stepData, direction, targetStep } = body;

    // Validate required fields
    if (!onboardingId) {
      return NextResponse.json(
        { error: 'Missing required field: onboardingId' },
        { status: 400 }
      );
    }

    let result;

    if (targetStep) {
      // Jump to specific step
      // Extract tenantId from the onboarding state first
      const currentState = await onboardingService.getOnboardingState(onboardingId, '');
      if (!currentState) {
        return NextResponse.json(
          { error: 'Onboarding state not found' },
          { status: 404 }
        );
      }

      result = await onboardingService.goToStep(onboardingId, currentState.tenantId, targetStep);
    } else if (direction === 'next') {
      // Navigate to next step
      const currentState = await onboardingService.getOnboardingState(onboardingId, '');
      if (!currentState) {
        return NextResponse.json(
          { error: 'Onboarding state not found' },
          { status: 404 }
        );
      }

      result = await onboardingService.nextStep(onboardingId, currentState.tenantId, stepData);
    } else if (direction === 'previous') {
      // Navigate to previous step
      const currentState = await onboardingService.getOnboardingState(onboardingId, '');
      if (!currentState) {
        return NextResponse.json(
          { error: 'Onboarding state not found' },
          { status: 404 }
        );
      }

      result = await onboardingService.previousStep(onboardingId, currentState.tenantId);
    } else {
      return NextResponse.json(
        { error: 'Missing navigation direction or target step' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error navigating onboarding:', error);

    if (error instanceof OnboardingError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          step: error.step,
          targetStep: (error as any).targetStep
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}