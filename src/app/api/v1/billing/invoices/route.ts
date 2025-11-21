/**
 * Invoices API
 * Part of Story 1.6: Subscription & Billing Access
 */

import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/services/billing-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const createInvoiceSchema = z.object({
  subscriptionId: z.string(),
  taxInformation: z.object({
    ppnRate: z.number().default(11),
    ppnAmount: z.number(),
    npwp: z.string().optional(),
    companyName: z.string(),
    companyAddress: z.string()
  })
});

/**
 * GET /api/v1/billing/invoices
 * Get invoices for tenant
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

    const invoices = await billingService.getInvoicesForTenant(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        count: invoices.length
      }
    });
  } catch (error) {
    console.error('[Get Invoices API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve invoices' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/billing/invoices
 * Create new invoice for subscription
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = createInvoiceSchema.safeParse(body);

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

    const invoice = await billingService.createInvoice(
      validation.data.subscriptionId,
      validation.data.taxInformation
    );

    return NextResponse.json({
      success: true,
      data: { invoice },
      message: 'Invoice created successfully',
      messageIndonesian: 'Faktur berhasil dibuat'
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Create Invoice API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
