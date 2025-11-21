/**
 * AI Pricing Suggestions API
 * POST /api/v1/vehicles/suggest-pricing
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.5: Intelligent Pricing Suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const suggestPricingSchema = z.object({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  tenantId: z.string().uuid('Invalid tenant ID'),
  mileage: z.number().positive().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  desiredPositioning: z.enum(['budget', 'competitive', 'premium']).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = suggestPricingSchema.parse(body);

    const pricingAnalysis = await vehicleService.suggestPricing({
      vehicleId: validated.vehicleId,
      tenantId: validated.tenantId,
      mileage: validated.mileage,
      condition: validated.condition,
      desiredPositioning: validated.desiredPositioning
    });

    return NextResponse.json({
      success: true,
      data: pricingAnalysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validasi gagal',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analisis pricing gagal'
      },
      { status: 500 }
    );
  }
}
