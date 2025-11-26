/**
 * POST /api/v1/vehicles/[id]/photos - Upload photos for a vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get image dimensions and metadata from base64
 */
function getImageMetadata(base64String: string): Promise<{
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
}> {
  return new Promise((resolve, reject) => {
    // Extract mime type from data URL
    const mimeMatch = base64String.match(/data:(image\/[a-z]+);base64,/);
    if (!mimeMatch) {
      reject(new Error('Invalid base64 image format'));
      return;
    }
    const mimeType = mimeMatch[1];

    // Calculate file size (rough estimate)
    const base64Data = base64String.split(',')[1];
    const fileSize = Math.round((base64Data.length * 3) / 4);

    // For dimensions, we'll use a simple approach in Node.js environment
    // In a real app, you'd want to use sharp or similar library
    // For now, we'll set default dimensions and let the client handle it
    // TODO: Implement proper dimension detection with sharp
    resolve({
      width: 1920,
      height: 1080,
      mimeType,
      fileSize,
    });
  });
}

/**
 * POST /api/v1/vehicles/[id]/photos
 * Upload photos for a vehicle
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;
    const body = await request.json();
    const { photos } = body; // Array of { base64: string }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'Photos array is required' },
        { status: 400 }
      );
    }

    // Verify vehicle exists and get tenantId
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, tenantId: true, make: true, model: true },
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

    // Process each photo and get metadata
    const photoRecordsPromises = photos.map(async (photo: { base64: string }, index: number) => {
      const metadata = await getImageMetadata(photo.base64);
      const filename = `${vehicle.make}-${vehicle.model}-${Date.now()}-${index + 1}.jpg`;
      const storageKey = `vehicles/${vehicleId}/${filename}`;

      return {
        vehicleId,
        tenantId: vehicle.tenantId,
        storageKey,
        originalUrl: photo.base64, // For now, store base64 directly
        thumbnailUrl: photo.base64, // TODO: Generate actual thumbnail
        mediumUrl: photo.base64,    // TODO: Generate medium size
        largeUrl: photo.base64,     // TODO: Generate large size
        filename,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        width: metadata.width,
        height: metadata.height,
        displayOrder: nextDisplayOrder + index,
        isMainPhoto: (nextDisplayOrder + index) === 1, // First photo is main
        isFeatured: false,
        qualityScore: null,
        validationStatus: 'PENDING',
        validationMessage: null,
        validationDetails: null,
        caption: null,
        uploadedBy: null, // TODO: Get from authenticated user session
      };
    });

    const photoRecords = await Promise.all(photoRecordsPromises);

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
