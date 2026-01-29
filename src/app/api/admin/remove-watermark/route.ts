import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PlateDetectionService } from '@/lib/services/inventory/plate-detection.service';

/**
 * API to regenerate vehicle photos WITHOUT license plate cover
 * This removes the "PRIMA MOBIL" watermark that was incorrectly added
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayId } = body;

    if (!displayId) {
      return NextResponse.json({
        success: false,
        error: 'displayId is required',
      }, { status: 400 });
    }

    // Get vehicle with photos
    const vehicle = await prisma.vehicle.findUnique({
      where: { displayId: displayId.toUpperCase() },
      include: {
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({
        success: false,
        error: `Vehicle ${displayId} not found`,
      }, { status: 404 });
    }

    if (vehicle.photos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No photos found for this vehicle',
      }, { status: 400 });
    }

    // Unfortunately, we cannot remove watermarks from already processed photos
    // because the watermark was burned into the image during upload.
    // The only solution is to re-upload the original photos.

    return NextResponse.json({
      success: false,
      error: 'Cannot remove watermarks from processed photos',
      message: 'Watermarks are burned into the image during processing. To fix this:',
      solutions: [
        '1. Download original photos from your phone/computer',
        '2. Go to dashboard: https://primamobil.id/dashboard/vehicles/' + vehicle.id,
        '3. Delete current photos',
        '4. Upload fresh photos (new uploads will NOT have watermark)',
      ],
      note: 'The watermark code has been disabled for NEW uploads, but existing photos still have it.',
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
