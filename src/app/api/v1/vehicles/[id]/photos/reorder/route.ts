/**
 * PATCH /api/v1/vehicles/[id]/photos/reorder
 * Batch update displayOrder for multiple photos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';
import { parseVehicleSlug } from '@/lib/utils';

interface ReorderItem {
  photoId: string;
  displayOrder: number;
}

/**
 * PATCH - Reorder photos in batch
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: any }
) {
  // Robustly handle both Next.js 14 (sync) and Next.js 15 (promise) params
  const { id } = await params;

  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { id: searchId, isUuid } = parseVehicleSlug(id);

    // Resolve vehicleId to actual UUID if it's a slug
    let vehicleId = searchId;
    if (!isUuid) {
      const v = await prisma.vehicle.findFirst({
        where: { displayId: searchId },
        select: { id: true }
      });
      if (v) {
        vehicleId = v.id;
      } else {
        return NextResponse.json(
          { error: 'Vehicle not found', message: `Could not find vehicle with ID or slug: ${id}` },
          { status: 404 }
        );
      }
    }
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
