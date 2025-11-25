#!/usr/bin/env node

/**
 * Script to delete all vehicles from the database
 * USE WITH CAUTION - This will delete ALL vehicles for ALL tenants
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllVehicles() {
  try {
    console.log('🔍 Checking for vehicles...\n');

    // Get count of vehicles
    const count = await prisma.vehicle.count();
    console.log(`Found ${count} vehicles in the database\n`);

    if (count === 0) {
      console.log('✅ No vehicles to delete\n');
      process.exit(0);
    }

    // Get some details first
    const vehicles = await prisma.vehicle.findMany({
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        tenantId: true,
        status: true,
      },
    });

    console.log('Vehicles to be deleted:');
    vehicles.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.make} ${v.model} ${v.year} (${v.status}) - Tenant: ${v.tenantId}`);
    });
    console.log('');

    // Delete all vehicle photos first (due to foreign key constraint)
    console.log('🗑️  Deleting vehicle photos...');
    const deletedPhotos = await prisma.vehiclePhoto.deleteMany({});
    console.log(`   Deleted ${deletedPhotos.count} photos\n`);

    // Delete all vehicles
    console.log('🗑️  Deleting vehicles...');
    const deletedVehicles = await prisma.vehicle.deleteMany({});
    console.log(`   Deleted ${deletedVehicles.count} vehicles\n`);

    console.log('✅ All vehicles have been deleted successfully!\n');
  } catch (error) {
    console.error('❌ Error deleting vehicles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllVehicles();
