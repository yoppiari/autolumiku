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

    // Get sales assignment info (might not exist in Prisma schema)
    let salesAssignments: Record<string, any> = {};
    try {
      const assignments = await prisma.$queryRaw<any[]>`
        SELECT id, "assignedSalesId", "assignedSalesName", "assignedAt", "soldBy", "soldByName", "soldAt"
        FROM vehicles
        WHERE "tenantId" = ${tenantId}
      `;
      assignments.forEach(a => {
        salesAssignments[a.id] = {
          assignedSalesId: a.assignedSalesId,
          assignedSalesName: a.assignedSalesName,
          assignedAt: a.assignedAt,
          soldBy: a.soldBy,
          soldByName: a.soldByName,
          soldAt: a.soldAt,
        };
      });
    } catch (e) {
      // Assignment columns might not exist yet - this is OK
    }

    // Convert BigInt to number for JSON serialization
    const vehiclesResponse = vehicles.map(vehicle => ({
      ...vehicle,
      price: Number(vehicle.price),
      aiSuggestedPrice: vehicle.aiSuggestedPrice ? Number(vehicle.aiSuggestedPrice) : null,
      // Add sales assignment info
      assignedSalesId: salesAssignments[vehicle.id]?.assignedSalesId || null,
      assignedSalesName: salesAssignments[vehicle.id]?.assignedSalesName || null,
      assignedAt: salesAssignments[vehicle.id]?.assignedAt || null,
      soldBy: salesAssignments[vehicle.id]?.soldBy || null,
      soldByName: salesAssignments[vehicle.id]?.soldByName || null,
      soldAt: salesAssignments[vehicle.id]?.soldAt || null,
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
 * Get tenant code from tenant data
 */
function getTenantCode(tenant: { slug: string; name: string }): string {
  const mapping: Record<string, string> = {
    'primamobil-id': 'PM',
    'primamobil': 'PM',
    'prima-mobil': 'PM',
  };

  if (mapping[tenant.slug]) {
    return mapping[tenant.slug];
  }

  // Generate from slug: take first letter of each word
  const words = tenant.slug.replace(/-/g, ' ').split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return tenant.slug.substring(0, 2).toUpperCase();
}

/**
 * Generate next displayId for vehicle
 * New format: {TENANT}-{SHOWROOM}-{SEQUENCE}
 * Example: PM-PST-001
 */
async function generateDisplayId(tenantId: string, showroomCode?: string): Promise<string> {
  // Get tenant info
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });

  if (!tenant) {
    // Fallback to old format
    return generateLegacyDisplayId();
  }

  const tenantCode = getTenantCode(tenant);
  const srCode = showroomCode || 'PST'; // Default to "Pusat" (main)

  // Get the highest existing displayId for this tenant+showroom
  const prefix = `${tenantCode}-${srCode}-`;

  const vehicles = await prisma.$queryRaw<any[]>`
    SELECT "displayId" FROM vehicles
    WHERE "displayId" LIKE ${prefix + '%'}
    ORDER BY "displayId" DESC
    LIMIT 1
  `;

  let nextNumber = 1;
  if (vehicles.length > 0 && vehicles[0].displayId) {
    const match = vehicles[0].displayId.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Legacy displayId format for backwards compatibility
 */
async function generateLegacyDisplayId(): Promise<string> {
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

    // Generate display ID with showroom code
    // Format: PM-PST-001 (Prima Mobil - Pusat - 001)
    const showroomCode = vehicleData.showroomCode || 'PST';
    const displayId = await generateDisplayId(tenantId, showroomCode);

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
