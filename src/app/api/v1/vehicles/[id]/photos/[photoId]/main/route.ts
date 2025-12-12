/**
 * PUT /api/v1/vehicles/[id]/photos/[photoId]/main
 * Set photo as main photo (unset previous main)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT - Set photo as main photo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
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

    // If already main, no need to update
    if (photo.isMainPhoto) {
      return NextResponse.json({
        success: true,
        message: 'Photo is already the main photo',
        data: photo,
      });
    }

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
      // Set new main photo
      prisma.vehiclePhoto.update({
        where: { id: photoId },
        data: { isMainPhoto: true },
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
