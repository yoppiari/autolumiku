/**
 * Script to create Enterprise subscriptions for ALL tenants that don't have one
 * This fixes the "No active subscription" bug for existing tenants
 *
 * Usage: npx tsx scripts/fix-missing-subscriptions.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding tenants without subscriptions...\n');

  try {
    // Find all tenants without subscription
    const tenantsWithoutSubscription = await prisma.tenant.findMany({
      where: {
        subscriptionId: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
      },
    });

    if (tenantsWithoutSubscription.length === 0) {
      console.log('✅ All tenants already have subscriptions!');
      process.exit(0);
    }

    console.log(`📋 Found ${tenantsWithoutSubscription.length} tenant(s) without subscription:\n`);
    tenantsWithoutSubscription.forEach((t: typeof tenantsWithoutSubscription[number], i: number) => {
      console.log(`   ${i + 1}. ${t.name} (${t.domain || t.slug})`);
    });

    console.log('\n🔧 Creating subscriptions...\n');

    // Set 14-month contract dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 14); // 14 months from now

    // Price: Rp 2,500,000 per month
    const pricePerMonth = 2500000;

    let successCount = 0;
    let failedCount = 0;

    for (const tenant of tenantsWithoutSubscription) {
      try {
        // Create subscription in transaction
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const subscription = await tx.subscription.create({
            data: {
              tenantId: tenant.id,
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
          await tx.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionId: subscription.id },
          });
        });

        console.log(`   ✅ ${tenant.name}: Subscription created`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ ${tenant.name}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
        failedCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`\n📝 Subscription Details Applied:`);
    console.log(`   - Plan: ENTERPRISE`);
    console.log(`   - Status: active`);
    console.log(`   - Contract Period: 14 months`);
    console.log(`   - Start: ${currentPeriodStart.toLocaleDateString('id-ID')}`);
    console.log(`   - End: ${currentPeriodEnd.toLocaleDateString('id-ID')}`);
    console.log(`   - Price/Month: Rp ${pricePerMonth.toLocaleString('id-ID')}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
