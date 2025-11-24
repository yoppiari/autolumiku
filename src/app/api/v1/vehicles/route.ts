/**
 * GET /api/v1/vehicles - List vehicles
 * POST /api/v1/vehicles - Create vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, VehicleStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/v1/vehicles
 * List vehicles for tenant
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get tenantId from authenticated user session
    // For now, get from query param (development only)
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
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

    return NextResponse.json({
      success: true,
      data: vehicles,
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

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        ...vehicleData,
        tenantId,
        createdBy: userId,
        status: vehicleData.status || VehicleStatus.DRAFT,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: vehicle,
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
