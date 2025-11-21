/**
 * Vehicle Detail API
 * GET /api/v1/vehicles/:id - Get vehicle
 * PATCH /api/v1/vehicles/:id - Update vehicle
 * DELETE /api/v1/vehicles/:id - Delete vehicle
 *
 * Epic 2: AI-Powered Vehicle Upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { vehicleService } from '@/services/vehicle-service';
import { z } from 'zod';

const updateVehicleSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  data: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().int().optional(),
    variant: z.string().optional(),
    descriptionId: z.string().optional(),
    descriptionEn: z.string().optional(),
    features: z.any().optional(),
    specifications: z.any().optional(),
    price: z.number().int().positive().optional(),
    mileage: z.number().int().positive().optional(),
    transmissionType: z.string().optional(),
    fuelType: z.string().optional(),
    color: z.string().optional(),
    licensePlate: z.string().optional(),
    engineCapacity: z.string().optional(),
    condition: z.string().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    isFeatured: z.boolean().optional()
  })
});

// GET - Get vehicle by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant ID required'
        },
        { status: 400 }
      );
    }

    const vehicle = await vehicleService.getVehicle(params.id, tenantId);

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kendaraan tidak ditemukan'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal mengambil data kendaraan'
      },
      { status: 500 }
    );
  }
}

// PATCH - Update vehicle
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = updateVehicleSchema.parse(body);

    const vehicle = await vehicleService.updateVehicle({
      vehicleId: params.id,
      tenantId: validated.tenantId,
      userId: validated.userId,
      data: validated.data
    });

    return NextResponse.json({
      success: true,
      data: vehicle
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
        error: error instanceof Error ? error.message : 'Gagal mengupdate kendaraan'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete vehicle
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant ID required'
        },
        { status: 400 }
      );
    }

    await vehicleService.deleteVehicle(params.id, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Kendaraan berhasil dihapus'
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal menghapus kendaraan'
      },
      { status: 500 }
    );
  }
}
