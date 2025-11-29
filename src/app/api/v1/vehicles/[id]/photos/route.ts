/**
 * POST /api/v1/vehicles/[id]/photos - Upload photos for a vehicle
 * Enhanced with multi-size generation, quality validation, and actual storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ImageProcessingService } from '@/lib/services/image-processing.service';
import { StorageService } from '@/lib/services/storage.service';
import { PhotoQualityService } from '@/lib/services/photo-quality.service';

const prisma = new PrismaClient();

/**
 * POST /api/v1/vehicles/[id]/photos
 * Upload photos with multi-size generation, quality validation, and storage
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

    // Verify vehicle exists and get details
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

    // Ensure upload directory exists
    await StorageService.ensureUploadDir();

    // Get the highest existing displayOrder
    const lastPhoto = await prisma.vehiclePhoto.findFirst({
      where: { vehicleId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    let nextDisplayOrder = lastPhoto ? lastPhoto.displayOrder + 1 : 1;

    // Process each photo: convert, validate, resize, upload
    const photoRecordsPromises = photos.map(async (photo: { base64: string }, index: number) => {
      try {
        // Convert base64 to buffer
        const buffer = ImageProcessingService.base64ToBuffer(photo.base64);

        // Validate quality
        const quality = await PhotoQualityService.validatePhoto(buffer);

        // Process image (generate all sizes)
        const processed = await ImageProcessingService.processPhoto(buffer);

        // Generate filename
        const baseFilename = ImageProcessingService.generateFilename(
          vehicleId,
          vehicle.make,
          vehicle.model,
          index,
          'original'
        );

        const filename = baseFilename.replace(/-original\.(jpg|webp)$/, '');

        // Upload to storage (all sizes)
        const storage = await StorageService.uploadMultipleSize(
          {
            original: processed.original,
            large: processed.large,
            medium: processed.medium,
            thumbnail: processed.thumbnail,
          },
          vehicleId,
          filename
        );

        return {
          vehicleId,
          tenantId: vehicle.tenantId,
          storageKey: storage.storageKey,
          originalUrl: storage.originalUrl,
          thumbnailUrl: storage.thumbnailUrl,
          mediumUrl: storage.mediumUrl,
          largeUrl: storage.largeUrl,
          filename: baseFilename,
          fileSize: processed.metadata.size,
          mimeType: processed.metadata.mimeType,
          width: processed.metadata.width,
          height: processed.metadata.height,
          displayOrder: nextDisplayOrder + index,
          isMainPhoto: (nextDisplayOrder + index) === 1,
          isFeatured: false,
          qualityScore: quality.score,
          validationStatus: quality.status,
          validationMessage: quality.message,
          validationDetails: quality.details,
          caption: null,
          uploadedBy: null, // TODO: Get from authenticated user session
        };
      } catch (error) {
        console.error(`Error processing photo ${index}:`, error);
        throw error;
      }
    });

    const photoRecords = await Promise.all(photoRecordsPromises);

    // Batch insert photos
    await prisma.vehiclePhoto.createMany({
      data: photoRecords,
    });

    // Count quality warnings (using PhotoValidationStatus enum values)
    const warnings = photoRecords.filter((p) => p.validationStatus === 'LOW_QUALITY');
    const rejected = photoRecords.filter((p) => p.validationStatus === 'REJECTED');

    return NextResponse.json(
      {
        success: true,
        message: `${photos.length} photo(s) uploaded successfully`,
        count: photos.length,
        quality: {
          approved: photoRecords.length - warnings.length - rejected.length,
          warnings: warnings.length,
          rejected: rejected.length,
        },
        photos: photoRecords.map((p) => ({
          storageKey: p.storageKey,
          qualityScore: p.qualityScore,
          validationStatus: p.validationStatus,
          validationMessage: p.validationMessage,
        })),
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
