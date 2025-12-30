/**
 * Fix vehicle price - divide by 100 if > 1 billion
 * Run: npx esbuild-register scripts/fix-vehicle-price.ts
 */

import { prisma } from '../src/lib/prisma';

async function fixVehiclePrice() {
  console.log('🔧 Starting vehicle price fix...');

  // Get vehicle PM-PST-001
  const vehicle = await prisma.vehicle.findUnique({
    where: { displayId: 'PM-PST-001' },
    select: {
      id: true,
      displayId: true,
      price: true,
    },
  });

  if (!vehicle) {
    console.log('❌ Vehicle PM-PST-001 not found');
    return;
  }

  const currentPrice = Number(vehicle.price);
  console.log(`📊 Current price: Rp ${currentPrice.toLocaleString('id-ID')}`);

  // Check if price is unreasonably high (> 1 billion for used car)
  if (currentPrice > 1000000000) {
    const correctPrice = Math.round(currentPrice / 100);
    console.log(`✅ Fixing price: ${currentPrice} → ${correctPrice}`);

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { price: correctPrice },
    });

    console.log(`✅ Price updated to: Rp ${correctPrice.toLocaleString('id-ID')}`);
  } else {
    console.log('✅ Price is reasonable, no fix needed');
  }

  await prisma.$disconnect();
}

fixVehiclePrice().catch(console.error);
