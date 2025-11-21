/**
 * Vehicle Publish API
 * POST /api/v1/vehicles/:id/publish
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.6: Vehicle Listing Review and Publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const publishSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  userId: z.string().uuid('Invalid user ID')
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = publishSchema.parse(body);

    const vehicle = await vehicleService.publishVehicle(
      params.id,
      validated.tenantId,
      validated.userId
    );

    return NextResponse.json({
      success: true,
      data: vehicle,
      message: 'Kendaraan berhasil dipublikasikan'
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
        error: error instanceof Error ? error.message : 'Gagal mempublikasikan kendaraan'
      },
      { status: 500 }
    );
  }
}
