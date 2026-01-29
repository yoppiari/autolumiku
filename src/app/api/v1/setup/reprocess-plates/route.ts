/**
 * POST /api/v1/setup/reprocess-plates
 * Re-process existing vehicle photos with AI plate detection
 * This is a one-time migration to cover plates on existing photos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PlateDetectionService } from '@/lib/services/inventory/plate-detection.service';
import { ImageProcessingService } from '@/lib/services/infrastructure/image-processing.service';
import { StorageService } from '@/lib/services/infrastructure/storage.service';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tenantSlug, vehicleId, limit = 10 } = body;

    console.log('[Reprocess Plates] Starting reprocess...');
    console.log('[Reprocess Plates] Params:', { tenantSlug, vehicleId, limit });

    // Build query
    const where: any = {};

    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, name: true, logoUrl: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      where.tenantId = tenant.id;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    // Get photos to reprocess
    const photos = await prisma.vehiclePhoto.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            tenant: {
              select: { name: true, logoUrl: true },
            },
          },
        },
      },
    });

    console.log(`[Reprocess Plates] Found ${photos.length} photos to process`);

    const results: any[] = [];

    for (const photo of photos) {
      try {
        console.log(`[Reprocess Plates] Processing photo ${photo.id}...`);

        // Download current photo
        const photoUrl = photo.originalUrl;

        // Skip if it's a base64 data URL (too large to process efficiently)
        if (photoUrl.startsWith('data:')) {
          console.log(`[Reprocess Plates] Skipping base64 photo ${photo.id}`);
          results.push({
            photoId: photo.id,
            status: 'skipped',
            reason: 'base64 photo - too large',
          });
          continue;
        }

        // Download photo
        const response = await fetch(photoUrl);
        if (!response.ok) {
          console.error(`[Reprocess Plates] Failed to download photo ${photo.id}: ${response.status}`);
          results.push({
            photoId: photo.id,
            status: 'error',
            reason: `Download failed: ${response.status}`,
          });
          continue;
        }

        const photoBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`[Reprocess Plates] Downloaded photo ${photo.id}: ${photoBuffer.length} bytes`);

        // Process with AI plate detection
        const tenantName = photo.vehicle.tenant.name;
        const tenantLogoUrl = photo.vehicle.tenant.logoUrl;

        const plateResult = await PlateDetectionService.processImage(photoBuffer, {
          tenantName: tenantName || 'PRIMA MOBIL',
          tenantLogoUrl: tenantLogoUrl || undefined,
        });

        console.log(`[Reprocess Plates] Photo ${photo.id}: ${plateResult.platesDetected} plates detected`);

        if (plateResult.platesDetected === 0) {
          results.push({
            photoId: photo.id,
            status: 'no_plates',
            platesDetected: 0,
          });
          continue;
        }

        // Re-process to generate all sizes with covered plate
        const processed = await ImageProcessingService.processPhoto(plateResult.covered);

        // Generate new filename
        const timestamp = Date.now();
        const baseFilename = `${photo.vehicle.make.toLowerCase()}-${photo.vehicle.model.toLowerCase()}-reprocessed-${timestamp}`;

        // Upload new versions
        const uploadResult = await StorageService.uploadMultipleSize(
          {
            original: processed.original,
            large: processed.large,
            medium: processed.medium,
            thumbnail: processed.thumbnail,
          },
          photo.vehicleId,
          baseFilename
        );

        // Update database with new URLs
        await prisma.vehiclePhoto.update({
          where: { id: photo.id },
          data: {
            originalUrl: uploadResult.originalUrl,
            thumbnailUrl: uploadResult.thumbnailUrl,
            mediumUrl: uploadResult.mediumUrl,
            largeUrl: uploadResult.largeUrl,
            storageKey: uploadResult.storageKey,
          },
        });

        console.log(`[Reprocess Plates] ✅ Photo ${photo.id} updated successfully`);

        results.push({
          photoId: photo.id,
          status: 'success',
          platesDetected: plateResult.platesDetected,
          newUrls: {
            original: uploadResult.originalUrl,
            thumbnail: uploadResult.thumbnailUrl,
          },
        });

      } catch (photoError: any) {
        console.error(`[Reprocess Plates] Error processing photo ${photo.id}:`, photoError.message);
        results.push({
          photoId: photo.id,
          status: 'error',
          reason: photoError.message,
        });
      }
    }

    const summary = {
      total: photos.length,
      success: results.filter(r => r.status === 'success').length,
      noPlates: results.filter(r => r.status === 'no_plates').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    console.log('[Reprocess Plates] Complete:', summary);

    return NextResponse.json({
      message: 'Reprocess complete',
      summary,
      results,
    });

  } catch (error: any) {
    console.error('[Reprocess Plates] Error:', error);
    return NextResponse.json(
      { error: 'Reprocess failed', message: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check status/count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant');

    const where: any = {};

    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        where.tenantId = tenant.id;
      }
    }

    const totalPhotos = await prisma.vehiclePhoto.count({ where });

    return NextResponse.json({
      totalPhotos,
      message: `Found ${totalPhotos} photos. POST to this endpoint to reprocess.`,
      usage: {
        method: 'POST',
        body: {
          tenantSlug: 'primamobil-id (optional)',
          vehicleId: 'uuid (optional)',
          limit: 10,
        },
      },
    });

  } catch (error: any) {
    console.error('[Reprocess Plates] GET Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
