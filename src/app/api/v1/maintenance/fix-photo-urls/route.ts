import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * FIX Photo URLs in Database
 * This endpoint updates all localhost/0.0.0.0 URLs to primamobil.id
 * 
 * Usage: GET /api/v1/maintenance/fix-photo-urls
 */
export async function GET() {
    try {
        console.log('[Fix Photo URLs] Starting...');

        // Get all photos with URLs containing localhost/0.0.0.0
        const photos = await prisma.vehiclePhoto.findMany({
            where: {
                OR: [
                    { mediumUrl: { contains: '0.0.0.0' } },
                    { originalUrl: { contains: '0.0.0.0' } },
                    { largeUrl: { contains: '0.0.0.0' } },
                    { thumbnailUrl: { contains: '0.0.0.0' } },
                    { mediumUrl: { contains: 'localhost' } },
                    { originalUrl: { contains: 'localhost' } },
                ]
            }
        });

        console.log(`[Fix Photo URLs] Found ${photos.length} photos with localhost/0.0.0.0 URLs`);

        if (photos.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All URLs are already correct!',
                fixed: 0
            });
        }

        // Update each photo
        let fixed = 0;
        const publicDomain = 'https://primamobil.id';

        for (const photo of photos) {
            const updates: any = {};

            if (photo.mediumUrl?.includes('0.0.0.0') || photo.mediumUrl?.includes('localhost')) {
                updates.mediumUrl = photo.mediumUrl
                    .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, publicDomain);
            }
            if (photo.originalUrl?.includes('0.0.0.0') || photo.originalUrl?.includes('localhost')) {
                updates.originalUrl = photo.originalUrl
                    .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, publicDomain);
            }
            if (photo.largeUrl?.includes('0.0.0.0') || photo.largeUrl?.includes('localhost')) {
                updates.largeUrl = photo.largeUrl
                    .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, publicDomain);
            }
            if (photo.thumbnailUrl?.includes('0.0.0.0') || photo.thumbnailUrl?.includes('localhost')) {
                updates.thumbnailUrl = photo.thumbnailUrl
                    .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, publicDomain);
            }

            if (Object.keys(updates).length > 0) {
                await prisma.vehiclePhoto.update({
                    where: { id: photo.id },
                    data: updates
                });
                fixed++;
                console.log(`[Fix Photo URLs] Fixed ${fixed}/${photos.length}`);
            }
        }

        console.log(`[Fix Photo URLs] ✅ Successfully fixed ${fixed} photos!`);

        return NextResponse.json({
            success: true,
            message: `Successfully fixed ${fixed} photos!`,
            total: photos.length,
            fixed
        });
    } catch (error) {
        console.error('[Fix Photo URLs] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
