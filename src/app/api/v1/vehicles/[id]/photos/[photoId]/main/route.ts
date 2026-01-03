/**
 * PUT /api/v1/vehicles/[id]/photos/[photoId]/main
 * Set photo as main photo (unset previous main)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';
import { parseVehicleSlug } from '@/lib/utils';

/**
 * PUT - Set photo as main photo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: any }
) {
  // Robustly handle both Next.js 14 (sync) and Next.js 15 (promise) params
  const { id, photoId } = await params;

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

    // Find photo
    const photo = await prisma.vehiclePhoto.findFirst({
      where: {
        id: photoId,
        vehicleId,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // If already main, no need to update
    if (photo.isMainPhoto) {
      return NextResponse.json({
        success: true,
        message: 'Photo is already the main photo',
        data: photo,
      });
    }

    // Get current displayOrder of the photo to be set as main
    const currentOrder = photo.displayOrder;

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Unset previous main photo
      prisma.vehiclePhoto.updateMany({
        where: {
          vehicleId,
          isMainPhoto: true,
        },
        data: {
          isMainPhoto: false,
        },
      }),
      // Shift all photos with displayOrder < currentOrder up by 1
      // This makes room for the new main photo at position 0
      prisma.vehiclePhoto.updateMany({
        where: {
          vehicleId,
          displayOrder: { lt: currentOrder },
        },
        data: {
          displayOrder: { increment: 1 },
        },
      }),
      // Set new main photo with displayOrder 0
      prisma.vehiclePhoto.update({
        where: { id: photoId },
        data: {
          isMainPhoto: true,
          displayOrder: 0,
        },
      }),
    ]);

    // Get updated photo
    const updatedPhoto = await prisma.vehiclePhoto.findUnique({
      where: { id: photoId },
    });

    return NextResponse.json({
      success: true,
      message: 'Main photo updated successfully',
      data: updatedPhoto,
    });
  } catch (error) {
    console.error('Set main photo error:', error);
    return NextResponse.json(
      {
        error: 'Failed to set main photo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
