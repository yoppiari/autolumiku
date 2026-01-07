import { prisma } from '../src/lib/prisma';

async function checkPhotoUrls() {
  console.log('🔍 Checking Vehicle Photo URLs in Database...\n');

  const photos = await prisma.vehiclePhoto.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      vehicleId: true,
      mediumUrl: true,
      originalUrl: true,
      vehicle: {
        select: {
          displayId: true,
          make: true,
          model: true
        }
      }
    }
  });

  console.log(`Found ${photos.length} most recent photos:\n`);

  photos.forEach((photo, i) => {
    console.log(`${i + 1}. ${photo.vehicle.displayId} - ${photo.vehicle.make} ${photo.vehicle.model}`);
    console.log(`   Medium URL: ${photo.mediumUrl}`);
    console.log(`   Original URL: ${photo.originalUrl}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkPhotoUrls();
