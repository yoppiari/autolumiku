import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const displayId = searchParams.get('displayId');
  const vehicleId = searchParams.get('vehicleId');

  try {
    let vehicle;
    let searchBy;

    if (vehicleId) {
      searchBy = `vehicleId: ${vehicleId}`;
      vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: {
          id: true,
          displayId: true,
          make: true,
          model: true,
          year: true,
          price: true,
          status: true,
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          photos: {
            select: {
              id: true,
              thumbnailUrl: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
            take: 20,
          },
        },
      });
    } else if (displayId) {
      searchBy = `displayId: ${displayId}`;
      vehicle = await prisma.vehicle.findUnique({
        where: { displayId: displayId.toUpperCase() },
        select: {
          id: true,
          displayId: true,
          make: true,
          model: true,
          year: true,
          price: true,
          status: true,
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          photos: {
            select: {
              id: true,
              thumbnailUrl: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
            take: 20,
          },
        },
      });
    } else {
      // List all vehicles
      const vehicles = await prisma.vehicle.findMany({
        select: {
          id: true,
          displayId: true,
          make: true,
          model: true,
          year: true,
          status: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        message: 'All vehicles (latest 10)',
        vehicles,
      });
    }

    if (!vehicle) {
      return NextResponse.json({
        success: false,
        message: `Vehicle not found (searched by ${searchBy})`,
        searchBy,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle found',
      searchBy,
      vehicle: {
        id: vehicle.id,
        displayId: vehicle.displayId,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price ? Number(vehicle.price) : 0,
        status: vehicle.status,
        tenantSlug: vehicle.tenant?.slug,
        tenantName: vehicle.tenant?.name,
        photoCount: vehicle.photos?.length || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
