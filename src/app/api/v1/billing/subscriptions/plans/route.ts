/**
 * Subscription Plans API
 * Part of Story 1.6: Subscription & Billing Access
 */

import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/services/billing-service';
import { rateLimiters } from '@/middleware/rate-limit';

/**
 * GET /api/v1/billing/subscriptions/plans
 * Get all available subscription plans
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const plans = await billingService.getAvailablePlans();

    return NextResponse.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('[Get Plans API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve plans' },
      { status: 500 }
    );
  }
}
