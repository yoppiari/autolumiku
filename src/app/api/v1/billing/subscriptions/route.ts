/**
 * Subscription Management API
 * Part of Story 1.6: Subscription & Billing Access
 */

import { NextRequest, NextResponse } from 'next/server';
import { billingService, SubscriptionPlan, PaymentMethod } from '@/services/billing-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.nativeEnum(SubscriptionPlan),
  paymentMethod: z.nativeEnum(PaymentMethod).optional()
});

/**
 * GET /api/v1/billing/subscriptions
 * Get subscription for tenant
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID required' },
        { status: 400 }
      );
    }

    const subscription = await billingService.getSubscription(tenantId);

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get usage metrics
    const usage = await billingService.getUsageMetrics(tenantId);
    const usageLimits = await billingService.checkUsageLimits(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        usage,
        usageLimits
      }
    });
  } catch (error) {
    console.error('[Get Subscription API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve subscription' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/billing/subscriptions
 * Create new subscription
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = createSubscriptionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const subscription = await billingService.createSubscription(
      validation.data.tenantId,
      validation.data.plan,
      validation.data.paymentMethod
    );

    return NextResponse.json({
      success: true,
      data: { subscription },
      message: 'Subscription created successfully',
      messageIndonesian: 'Langganan berhasil dibuat'
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Create Subscription API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
