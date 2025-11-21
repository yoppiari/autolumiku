/**
 * AI Description Generation API
 * POST /api/v1/vehicles/generate-description
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.4: Comprehensive AI Description Generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const generateDescriptionSchema = z.object({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  tenantId: z.string().uuid('Invalid tenant ID'),
  tone: z.enum(['professional', 'casual', 'promotional']).optional(),
  emphasis: z.enum(['features', 'performance', 'family', 'luxury', 'value']).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = generateDescriptionSchema.parse(body);

    const description = await vehicleService.generateDescription({
      vehicleId: validated.vehicleId,
      tenantId: validated.tenantId,
      tone: validated.tone,
      emphasis: validated.emphasis
    });

    return NextResponse.json({
      success: true,
      data: description
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
        error: error instanceof Error ? error.message : 'Generate deskripsi gagal'
      },
      { status: 500 }
    );
  }
}
