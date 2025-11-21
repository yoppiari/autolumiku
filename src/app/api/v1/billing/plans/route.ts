/**
 * Subscription Plans API
 * Epic 1: Story 1.6 - Billing Management
 *
 * Endpoint:
 * - GET /api/v1/billing/plans - Get all available subscription plans
 */

import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/services/billing.service';

/**
 * GET /api/v1/billing/plans
 * Get all available subscription plans
 */
export const GET = async (request: NextRequest) => {
  try {
    // Get all plans (public endpoint)
    const plans = await billingService.getPlans();

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error('Get plans API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve plans',
      },
      { status: 500 }
    );
  }
};
