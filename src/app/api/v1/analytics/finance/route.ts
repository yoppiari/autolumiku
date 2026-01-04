/**
 * GET /api/v1/analytics/finance - Finance/Accounting Department Analytics
 *
 * Protected: Requires ADMIN+ role (roleLevel >= 90)
 * Returns invoice summary, payment collection, receivables, cash flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: Require ADMIN+ role (roleLevel >= 90)
  if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
    return NextResponse.json(
      { error: 'Forbidden - Admin role or higher required for analytics' },
      { status: 403 }
    );
  }

  try {
    const tenantId = auth.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }

    // Return zeroed out data as finance feature is disabled
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalInvoices: 0,
          totalBilled: 0,
          totalCollected: 0,
          outstandingReceivables: 0,
          collectionRate: 0,
          overdueCount: 0,
          overdueValue: 0,
        },
        invoiceBreakdown: [],
        paymentMethods: [],
        cashFlowTrend: [],
        agingBuckets: [],
        topReceivables: [],
        paymentsInPeriod: {
          count: 0,
          value: 0,
        },
        timeRange: '30d',
        period: 'monthly',
        generated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Finance analytics error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
