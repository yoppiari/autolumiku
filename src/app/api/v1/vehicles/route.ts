/**
 * GET /api/v1/vehicles - List vehicles
 * POST /api/v1/vehicles - Create vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { VehicleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/vehicles
 * List vehicles for tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let tenantId = searchParams.get('tenantId');
    const slug = searchParams.get('slug');

    // If slug provided, lookup tenant by slug
    if (!tenantId && slug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId or slug is required' },
        { status: 400 }
      );
    }

    // Get filters
    const status = searchParams.get('status') as VehicleStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    // Get vehicles with pagination
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          photos: {
            orderBy: { displayOrder: 'asc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.vehicle.count({ where }),
    ]);

    // Convert BigInt to number for JSON serialization
    const vehiclesResponse = vehicles.map(vehicle => ({
      ...vehicle,
      price: Number(vehicle.price),
      aiSuggestedPrice: vehicle.aiSuggestedPrice ? Number(vehicle.aiSuggestedPrice) : null,
    }));

    return NextResponse.json({
      success: true,
      data: vehiclesResponse,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get vehicles error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get vehicles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate next displayId for vehicle
 */
async function generateDisplayId(): Promise<string> {
  // Get the highest existing displayId
  const lastVehicle = await prisma.vehicle.findFirst({
    where: {
      displayId: {
        startsWith: 'VH-',
      },
    },
    orderBy: {
      displayId: 'desc',
    },
    select: {
      displayId: true,
    },
  });

  let nextNumber = 1;
  if (lastVehicle && lastVehicle.displayId) {
    const match = lastVehicle.displayId.match(/VH-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `VH-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * POST /api/v1/vehicles
 * Create new vehicle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Get tenantId and userId from authenticated user session
    const { tenantId, userId, ...vehicleData } = body;

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'tenantId and userId are required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['make', 'model', 'year', 'price'];
    for (const field of requiredFields) {
      if (!vehicleData[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Generate display ID
    const displayId = await generateDisplayId();

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        displayId,
        // Basic Information
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        variant: vehicleData.variant,

        // AI-Generated Content
        descriptionId: vehicleData.descriptionId,
        features: vehicleData.features,
        specifications: vehicleData.specifications,

        // AI Metadata
        aiConfidence: vehicleData.aiConfidence,
        aiReasoning: vehicleData.aiReasoning,

        // Pricing (convert to BigInt for database)
        price: BigInt(vehicleData.price),
        aiSuggestedPrice: vehicleData.aiSuggestedPrice ? BigInt(vehicleData.aiSuggestedPrice) : null,
        priceConfidence: vehicleData.priceConfidence,
        priceAnalysis: vehicleData.priceAnalysis,

        // Vehicle Details
        mileage: vehicleData.mileage,
        transmissionType: vehicleData.transmissionType,
        fuelType: vehicleData.fuelType,
        color: vehicleData.color,

        // Status
        status: vehicleData.status || VehicleStatus.DRAFT,

        // Metadata
        tenantId,
        createdBy: userId,
      },
    });

    // Convert BigInt to number for JSON serialization
    const vehicleResponse = {
      ...vehicle,
      price: Number(vehicle.price),
      aiSuggestedPrice: vehicle.aiSuggestedPrice ? Number(vehicle.aiSuggestedPrice) : null,
    };

    return NextResponse.json(
      {
        success: true,
        data: vehicleResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create vehicle error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create vehicle',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
