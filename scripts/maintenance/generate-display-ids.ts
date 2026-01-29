import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate human-readable display IDs for all vehicles
 * Format: VH-001, VH-002, VH-003, etc.
 */
async function generateDisplayIds() {
  try {
    console.log('🔄 Generating display IDs for vehicles...\n');

    // Get all vehicles without displayId, ordered by createdAt
    const vehicles = await prisma.vehicle.findMany({
      where: {
        displayId: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        createdAt: true,
      },
    });

    if (vehicles.length === 0) {
      console.log('✅ All vehicles already have display IDs!');
      return;
    }

    console.log(`Found ${vehicles.length} vehicle(s) without display ID\n`);

    // Get the highest existing displayId number
    const lastVehicle = await prisma.vehicle.findFirst({
      where: {
        displayId: {
          startsWith: 'VH-',
        },
      },
      orderBy: {
        displayId: 'desc',
      },
      select: {
        displayId: true,
      },
    });

    let startNumber = 1;
    if (lastVehicle && lastVehicle.displayId) {
      const match = lastVehicle.displayId.match(/VH-(\d+)/);
      if (match) {
        startNumber = parseInt(match[1], 10) + 1;
      }
    }

    console.log(`Starting from: VH-${String(startNumber).padStart(3, '0')}\n`);

    // Update each vehicle
    let counter = startNumber;
    for (const vehicle of vehicles) {
      const displayId = `VH-${String(counter).padStart(3, '0')}`;

      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { displayId },
      });

      console.log(`✅ ${displayId} → ${vehicle.make} ${vehicle.model} ${vehicle.year}`);
      counter++;
    }

    console.log(`\n✨ Successfully generated ${vehicles.length} display IDs!`);
  } catch (error) {
    console.error('❌ Error generating display IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateDisplayIds();
