import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVehicles() {
  try {
    console.log('🔍 Checking vehicles in database...\n');

    // Get all vehicles
    const vehicles = await prisma.vehicle.findMany({
      include: {
        photos: true,
      },
    });

    console.log(`Found ${vehicles.length} vehicle(s)\n`);

    if (vehicles.length === 0) {
      console.log('❌ No vehicles found in database');
      return;
    }

    // Display each vehicle
    vehicles.forEach((vehicle, index) => {
      console.log(`\n📍 Vehicle #${index + 1}:`);
      console.log(`   ID: ${vehicle.id}`);
      console.log(`   Tenant ID: ${vehicle.tenantId}`);
      console.log(`   Make: ${vehicle.make}`);
      console.log(`   Model: ${vehicle.model}`);
      console.log(`   Year: ${vehicle.year}`);
      console.log(`   Status: ${vehicle.status}`);
      console.log(`   Price: Rp ${Number(vehicle.price) / 100000000} jt`);
      console.log(`   Photos: ${vehicle.photos.length}`);
      console.log(`   Created: ${vehicle.createdAt}`);
    });

    // Get tenant info
    console.log('\n\n🏢 Checking tenants...\n');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
      },
    });

    console.log(`Found ${tenants.length} tenant(s)\n`);
    tenants.forEach((tenant, index) => {
      console.log(`\n📍 Tenant #${index + 1}:`);
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Name: ${tenant.name}`);
      console.log(`   Subdomain: ${tenant.subdomain}`);
      console.log(`   Status: ${tenant.status}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicles();
