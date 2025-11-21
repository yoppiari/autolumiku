/**
 * AI Vehicle Identification API
 * POST /api/v1/vehicles/identify
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.3: AI Vehicle Identification
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const identifySchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, 'At least one photo required').max(20, 'Maximum 20 photos'),
  tenantId: z.string().uuid('Invalid tenant ID')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = identifySchema.parse(body);

    const identification = await vehicleService.identifyVehicle({
      photoIds: validated.photoIds,
      tenantId: validated.tenantId
    });

    return NextResponse.json({
      success: true,
      data: identification
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
        error: error instanceof Error ? error.message : 'Identifikasi kendaraan gagal'
      },
      { status: 500 }
    );
  }
}
