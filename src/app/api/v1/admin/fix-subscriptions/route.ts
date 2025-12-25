/**
 * Fix Missing Subscriptions API
 * POST /api/v1/admin/fix-subscriptions
 *
 * Creates Enterprise subscriptions for all tenants without one
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    // Find all tenants with subscription for comparison
    const tenantsWithSubscription = await prisma.tenant.findMany({
      where: {
        subscriptionId: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: tenantsWithoutSubscription.length > 0
        ? `Found ${tenantsWithoutSubscription.length} tenant(s) without subscription. Use POST to fix.`
        : 'All tenants have subscriptions.',
      tenantsWithoutSubscription,
      tenantsWithSubscription: tenantsWithSubscription.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.subscription?.plan,
        status: t.subscription?.status,
        expiresAt: t.subscription?.currentPeriodEnd,
      })),
    });
  } catch (error: any) {
    console.error('[Fix Subscriptions] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
      },
    });

    if (tenantsWithoutSubscription.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All tenants already have subscriptions!',
        fixed: 0,
      });
    }

    // Set annual contract dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

    // Annual price: Rp 30,000,000 per year
    const annualPrice = 30000000;
    const pricePerMonth = Math.floor(annualPrice / 12);

    const results: Array<{ tenant: string; success: boolean; error?: string }> = [];

    for (const tenant of tenantsWithoutSubscription) {
      try {
        await prisma.$transaction(async (tx) => {
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

          await tx.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionId: subscription.id },
          });
        });

        results.push({ tenant: tenant.name, success: true });
      } catch (error: any) {
        results.push({ tenant: tenant.name, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Fixed ${successCount} subscription(s), ${failedCount} failed`,
      fixed: successCount,
      failed: failedCount,
      details: results,
      subscriptionDetails: {
        plan: 'enterprise',
        status: 'active',
        contractPeriod: '1 year',
        start: currentPeriodStart.toISOString(),
        end: currentPeriodEnd.toISOString(),
        annualPrice: `Rp ${annualPrice.toLocaleString('id-ID')}`,
      },
    });
  } catch (error: any) {
    console.error('[Fix Subscriptions] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
