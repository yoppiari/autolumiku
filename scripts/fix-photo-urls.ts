import { prisma } from '../src/lib/prisma';

async function fixPhotoUrls() {
    console.log('🔧 Fixing Photo URLs in Database...\n');

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

    console.log(`Found ${photos.length} photos with localhost/0.0.0.0 URLs\n`);

    if (photos.length === 0) {
        console.log('✅ All URLs are already correct!');
        await prisma.$disconnect();
        return;
    }

    // Update each photo
    let fixed = 0;
    for (const photo of photos) {
        const updates: any = {};

        if (photo.mediumUrl?.includes('0.0.0.0') || photo.mediumUrl?.includes('localhost')) {
            updates.mediumUrl = photo.mediumUrl
                .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, 'https://primamobil.id');
        }
        if (photo.originalUrl?.includes('0.0.0.0') || photo.originalUrl?.includes('localhost')) {
            updates.originalUrl = photo.originalUrl
                .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, 'https://primamobil.id');
        }
        if (photo.largeUrl?.includes('0.0.0.0') || photo.largeUrl?.includes('localhost')) {
            updates.largeUrl = photo.largeUrl
                .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, 'https://primamobil.id');
        }
        if (photo.thumbnailUrl?.includes('0.0.0.0') || photo.thumbnailUrl?.includes('localhost')) {
            updates.thumbnailUrl = photo.thumbnailUrl
                .replace(/https?:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)(:\d+)?/, 'https://primamobil.id');
        }

        if (Object.keys(updates).length > 0) {
            await prisma.vehiclePhoto.update({
                where: { id: photo.id },
                data: updates
            });
            fixed++;
            console.log(`✅ Fixed photo ${fixed}/${photos.length}: ${photo.id.substring(0, 8)}...`);
        }
    }

    console.log(`\n🎉 Successfully fixed ${fixed} photos!`);
    await prisma.$disconnect();
}

fixPhotoUrls().catch(console.error);
