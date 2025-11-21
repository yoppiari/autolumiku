/**
 * Subscription API
 * Epic 1: Story 1.6 - Billing Management
 *
 * Endpoint:
 * - GET /api/v1/billing/subscription/:tenantId - Get current subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { billingService } from '@/services/billing.service';

/**
 * GET /api/v1/billing/subscription/:tenantId
 * Get current subscription for a tenant
 */
export const GET = withAuth(async (request, { user, params }) => {
  try {
    const tenantId = params?.tenantId as string;

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing tenant ID',
          message: 'tenantId is required',
        },
        { status: 400 }
      );
    }

    // Check if user has access to this tenant
    if (user.tenantId !== tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only view your own subscription',
        },
        { status: 403 }
      );
    }

    // Get current subscription
    const result = await billingService.getCurrentSubscription(tenantId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve subscription',
          message: result.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get subscription API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve subscription',
      },
      { status: 500 }
    );
  }
});
