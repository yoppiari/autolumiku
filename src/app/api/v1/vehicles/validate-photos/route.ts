/**
 * Vehicle Photo Validation API
 * POST /api/v1/vehicles/validate-photos
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.2: Real-Time Photo Validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const validatePhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, 'At least one photo required'),
  tenantId: z.string().uuid('Invalid tenant ID')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validatePhotosSchema.parse(body);

    const result = await vehicleService.validatePhotos({
      photoIds: validated.photoIds,
      tenantId: validated.tenantId
    });

    return NextResponse.json({
      success: true,
      data: result
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
        error: error instanceof Error ? error.message : 'Validasi foto gagal'
      },
      { status: 500 }
    );
  }
}
