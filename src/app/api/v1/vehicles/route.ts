/**
 * Vehicle CRUD API
 * GET /api/v1/vehicles - List vehicles
 * POST /api/v1/vehicles - Create vehicle
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.6: Vehicle Listing Review and Publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';
import { VehicleStatus } from '@prisma/client';

const createVehicleSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  variant: z.string().optional(),
  mileage: z.number().int().positive().optional(),
  transmissionType: z.string().optional(),
  fuelType: z.string().optional(),
  color: z.string().optional(),
  licensePlate: z.string().optional(),
  condition: z.string().optional(),
  price: z.number().int().positive().optional()
});

// POST - Create vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createVehicleSchema.parse(body);

    const vehicle = await vehicleService.createVehicle(validated);

    return NextResponse.json({
      success: true,
      data: vehicle
    }, { status: 201 });
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
        error: error instanceof Error ? error.message : 'Gagal membuat kendaraan'
      },
      { status: 500 }
    );
  }
}

// GET - List vehicles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status') as VehicleStatus | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant ID required'
        },
        { status: 400 }
      );
    }

    const result = await vehicleService.listVehicles(tenantId, {
      status: status || undefined,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal mengambil daftar kendaraan'
      },
      { status: 500 }
    );
  }
}
