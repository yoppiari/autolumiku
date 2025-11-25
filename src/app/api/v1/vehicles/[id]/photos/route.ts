/**
 * POST /api/v1/vehicles/[id]/photos - Upload photos for a vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/v1/vehicles/[id]/photos
 * Upload photos for a vehicle
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vehicleId = params.id;
    const body = await request.json();
    const { photos } = body; // Array of { base64: string }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'Photos array is required' },
        { status: 400 }
      );
    }

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Get the highest existing displayOrder for this vehicle
    const lastPhoto = await prisma.vehiclePhoto.findFirst({
      where: { vehicleId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    let nextDisplayOrder = lastPhoto ? lastPhoto.displayOrder + 1 : 1;

    // Create photo records
    const photoRecords = photos.map((photo: { base64: string }, index: number) => ({
      vehicleId,
      originalUrl: photo.base64, // For now, store base64 directly
      thumbnailUrl: photo.base64, // TODO: Generate actual thumbnail
      displayOrder: nextDisplayOrder + index,
    }));

    // Batch insert photos
    await prisma.vehiclePhoto.createMany({
      data: photoRecords,
    });

    return NextResponse.json(
      {
        success: true,
        message: `${photos.length} photo(s) uploaded successfully`,
        count: photos.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload photos error:', error);

    return NextResponse.json(
      {
        error: 'Failed to upload photos',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
