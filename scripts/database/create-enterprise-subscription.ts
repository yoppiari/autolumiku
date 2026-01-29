/**
 * Script to create Enterprise Annual Subscription for a tenant
 * Usage: npx tsx scripts/create-enterprise-subscription.ts <tenantId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('❌ Please provide tenantId as argument');
    console.error('Usage: npx tsx scripts/create-enterprise-subscription.ts <tenantId>');
    process.exit(1);
  }

  try {
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) {
      console.error(`❌ Tenant with ID ${tenantId} not found`);
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name}`);

    if (tenant.subscription) {
      console.log(`⚠️  Tenant already has a subscription:`);
      console.log(`   - Plan: ${tenant.subscription.plan}`);
      console.log(`   - Status: ${tenant.subscription.status}`);
      console.log(`   - Period: ${tenant.subscription.currentPeriodStart.toISOString().split('T')[0]} to ${tenant.subscription.currentPeriodEnd.toISOString().split('T')[0]}`);

      const shouldUpdate = process.argv[3] === '--force';
      if (!shouldUpdate) {
        console.log('\n💡 Use --force flag to update existing subscription');
        process.exit(0);
      }
    }

    // Set annual contract dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1); // 1 year from now

    // Annual price: Rp 30,000,000 per year
    const annualPrice = 30000000; // 30 juta rupiah
    const pricePerMonth = Math.floor(annualPrice / 12);

    let subscription;

    if (tenant.subscription) {
      // Update existing
      subscription = await prisma.subscription.update({
        where: { id: tenant.subscription.id },
        data: {
          plan: 'enterprise',
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd,
          trialEnd: null,
          pricePerMonth,
          currency: 'IDR',
        },
      });
      console.log('\n✅ Subscription updated successfully!');
    } else {
      // Create new
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          plan: 'enterprise',
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd,
          trialEnd: null,
          pricePerMonth,
          currency: 'IDR',
        },
      });

      // Link to tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionId: subscription.id },
      });

      console.log('\n✅ Enterprise subscription created successfully!');
    }

    console.log('\n📊 Subscription Details:');
    console.log(`   Plan: ${subscription.plan.toUpperCase()}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Contract Start: ${subscription.currentPeriodStart.toLocaleDateString('id-ID')}`);
    console.log(`   Contract End: ${subscription.currentPeriodEnd.toLocaleDateString('id-ID')}`);
    console.log(`   Annual Price: Rp ${annualPrice.toLocaleString('id-ID')}`);
    console.log(`   Monthly Rate: Rp ${pricePerMonth.toLocaleString('id-ID')}`);

    // Calculate days remaining
    const daysRemaining = Math.ceil((subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   Days Remaining: ${daysRemaining} days (${Math.ceil(daysRemaining / 30)} months)`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
