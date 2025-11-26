/**
 * POST /api/v1/leads/track
 * Track WhatsApp clicks and other lead events
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeadService } from '@/lib/services/lead-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, vehicleId, source, metadata } = body;

    if (!tenantId || !source) {
      return NextResponse.json(
        { error: 'tenantId and source are required' },
        { status: 400 }
      );
    }

    const result = await LeadService.trackWhatsAppClick({
      tenantId,
      vehicleId,
      source,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Track event error:', error);
    return NextResponse.json(
      {
        error: 'Failed to track event',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
