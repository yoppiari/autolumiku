import { NextRequest, NextResponse } from 'next/server';
import { onboardingService } from '@/services/onboarding-service';
import { GetHelpRequest } from '@/types/onboarding';

/**
 * Onboarding Help API
 *
 * POST /api/onboarding/help - Get help content for step
 */

export async function POST(request: NextRequest) {
  try {
    const body: GetHelpRequest = await request.json();
    const { step, context, language = 'id' } = body;

    // Validate required fields
    if (!step) {
      return NextResponse.json(
        { error: 'Missing required field: step' },
        { status: 400 }
      );
    }

    // Get help content
    const helpContent = await onboardingService.getStepHelp(step, context);

    if (!helpContent) {
      return NextResponse.json(
        { error: 'Help content not found for step' },
        { status: 404 }
      );
    }

    // Return localized content
    const localizedHelp = {
      title: helpContent.title[language] || helpContent.title.id,
      sections: helpContent.sections.map(section => ({
        title: section.title[language] || section.title.id,
        content: section.content[language] || section.content.id,
        type: section.type,
        mediaUrl: section.mediaUrl
      })),
      tips: helpContent.tips,
      relatedDocs: helpContent.relatedDocs
    };

    return NextResponse.json({
      success: true,
      data: localizedHelp
    });

  } catch (error) {
    console.error('Error getting help content:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}