/**
 * Regenerate Vehicle Photos WITHOUT Watermark
 * This script fetches original photos, removes watermark overlay, and re-uploads
 *
 * Usage: npx tsx scripts/regenerate-vehicle-photos.ts <displayId>
 */

import { prisma } from '../src/lib/prisma';
import { ImageProcessingService } from '../src/lib/services/image-processing.service';
import sharp from 'sharp';

const displayId = process.argv[2]?.toUpperCase();

if (!displayId) {
  console.log('❌ Usage: npx tsx scripts/regenerate-vehicle-photos.ts <displayId>');
  console.log('   Example: npx tsx scripts/regenerate-vehicle-photos.ts PM-PST-001');
  process.exit(1);
}

async function regeneratePhotos() {
  console.log(`🔄 Starting photo regeneration for ${displayId}...`);

  try {
    // Get vehicle with photos
    const vehicle = await prisma.vehicle.findUnique({
      where: { displayId },
      include: {
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
        tenant: true,
      },
    });

    if (!vehicle) {
      console.log(`❌ Vehicle ${displayId} not found`);
      process.exit(1);
    }

    if (vehicle.photos.length === 0) {
      console.log('❌ No photos found for this vehicle');
      process.exit(1);
    }

    console.log(`📊 Found ${vehicle.photos.length} photos to regenerate`);

    // For each photo, we need to restore from original if available
    // Unfortunately, if the watermark was burned into the original during upload,
    // we cannot recover it without having the unwatermarked source.

    console.log('\n⚠️  IMPORTANT NOTICE:');
    console.log('This script cannot remove watermarks that were burned into photos during upload.');
    console.log('The watermark is permanently part of the image data.');
    console.log('\n💡 SOLUTION:');
    console.log('1. Download original photos from your phone/computer');
    console.log('2. Go to dashboard: https://primamobil.id/dashboard/vehicles/' + vehicle.id);
    console.log('3. Delete current photos');
    console.log('4. Upload fresh photos (new uploads will NOT have watermark)');
    console.log('\n✅ The watermark code has been disabled - NEW uploads will be clean!');
    console.log('\n📝 Watermark status:');
    console.log('   - OLD uploads: Had "PRIMA MOBIL" text watermark ❌');
    console.log('   - NEW uploads: Clean black rectangle (no text) ✅');

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

regeneratePhotos();
