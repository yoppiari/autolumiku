/**
 * DELETE /api/v1/vehicles/[id]/photos/[photoId] - Delete single photo
 * PUT /api/v1/vehicles/[id]/photos/[photoId] - Update photo (caption, featured flag)
 */

import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/services/storage.service';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

/**
 * DELETE - Remove photo from vehicle
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: All authenticated roles can access vehicle photos
  // Sales, Admin, Owner, Super Admin all have access

  try {
    const { id: vehicleId, photoId } = await params;

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

    // Delete from storage
    await StorageService.deleteMultipleSizes(photo.storageKey);

    // Delete from database
    await prisma.vehiclePhoto.delete({
      where: { id: photoId },
    });

    // If deleted photo was main, set next photo as main
    if (photo.isMainPhoto) {
      const nextPhoto = await prisma.vehiclePhoto.findFirst({
        where: { vehicleId },
        orderBy: { displayOrder: 'asc' },
      });

      if (nextPhoto) {
        await prisma.vehiclePhoto.update({
          where: { id: nextPhoto.id },
          data: { isMainPhoto: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete photo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update photo metadata (caption, featured flag)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: All authenticated roles can access vehicle photos
  // Sales, Admin, Owner, Super Admin all have access

  try {
    const { id: vehicleId, photoId } = await params;
    const body = await request.json();
    const { caption, isFeatured } = body;

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

    // Update photo
    const updatedPhoto = await prisma.vehiclePhoto.update({
      where: { id: photoId },
      data: {
        ...(caption !== undefined && { caption }),
        ...(isFeatured !== undefined && { isFeatured }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedPhoto,
    });
  } catch (error) {
    console.error('Update photo error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update photo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
