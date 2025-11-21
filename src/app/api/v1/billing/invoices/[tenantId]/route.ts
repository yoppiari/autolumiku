/**
 * Invoices API
 * Epic 1: Story 1.6 - Billing Management
 *
 * Endpoint:
 * - GET /api/v1/billing/invoices/:tenantId - Get all invoices for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { billingService } from '@/services/billing.service';

/**
 * GET /api/v1/billing/invoices/:tenantId
 * Get all invoices for a tenant
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
          message: 'You can only view your own invoices',
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || undefined;

    // Get invoices
    const result = await billingService.getInvoices(tenantId, {
      page,
      limit,
      status,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve invoices',
          message: result.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get invoices API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve invoices',
      },
      { status: 500 }
    );
  }
});
