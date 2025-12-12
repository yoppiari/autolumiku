/**
 * GET/PUT /api/v1/tenants/[id]/subscription
 * Manage tenant subscription (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subscription: tenant.subscription,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = await request.json();

    const {
      plan,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      trialEnd,
      pricePerMonth,
    } = body;

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    let subscription;

    if (tenant.subscription) {
      // Update existing subscription
      subscription = await prisma.subscription.update({
        where: { id: tenant.subscription.id },
        data: {
          plan,
          status,
          currentPeriodStart: new Date(currentPeriodStart),
          currentPeriodEnd: new Date(currentPeriodEnd),
          trialEnd: trialEnd ? new Date(trialEnd) : null,
          pricePerMonth: parseInt(pricePerMonth),
        },
      });
    } else {
      // Create new subscription
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          plan,
          status,
          currentPeriodStart: new Date(currentPeriodStart),
          currentPeriodEnd: new Date(currentPeriodEnd),
          trialEnd: trialEnd ? new Date(trialEnd) : null,
          pricePerMonth: parseInt(pricePerMonth),
          currency: 'IDR',
        },
      });

      // Link subscription to tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionId: subscription.id },
      });
    }

    return NextResponse.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
