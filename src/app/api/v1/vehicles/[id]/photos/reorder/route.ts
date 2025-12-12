/**
 * PATCH /api/v1/vehicles/[id]/photos/reorder
 * Batch update displayOrder for multiple photos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ReorderItem {
  photoId: string;
  displayOrder: number;
}

/**
 * PATCH - Reorder photos in batch
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;
    const body = await request.json();
    const { photos }: { photos: ReorderItem[] } = body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'Photos array is required' },
        { status: 400 }
      );
    }

    // Verify all photos belong to this vehicle
    const photoIds = photos.map((p) => p.photoId);
    const existingPhotos = await prisma.vehiclePhoto.findMany({
      where: {
        id: { in: photoIds },
        vehicleId,
      },
      select: { id: true },
    });

    if (existingPhotos.length !== photoIds.length) {
      return NextResponse.json(
        { error: 'Some photos do not belong to this vehicle' },
        { status: 400 }
      );
    }

    // Update displayOrder for each photo in batch
    const updatePromises = photos.map((item) =>
      prisma.vehiclePhoto.update({
        where: { id: item.photoId },
        data: { displayOrder: item.displayOrder },
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `${photos.length} photo(s) reordered successfully`,
      count: photos.length,
    });
  } catch (error) {
    console.error('Reorder photos error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reorder photos',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
