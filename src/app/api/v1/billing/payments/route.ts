/**
 * Payments API
 * Part of Story 1.6: Subscription & Billing Access
 */

import { NextRequest, NextResponse } from 'next/server';
import { billingService, PaymentMethod } from '@/services/billing-service';
import { rateLimiters } from '@/middleware/rate-limit';
import { z } from 'zod';

const processPaymentSchema = z.object({
  invoiceId: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  gatewayTransactionId: z.string().optional()
});

/**
 * GET /api/v1/billing/payments
 * Get payment history for tenant
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

    const payments = await billingService.getPaymentHistory(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        count: payments.length
      }
    });
  } catch (error) {
    console.error('[Get Payments API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/billing/payments
 * Process payment for invoice
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiters.api(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const validation = processPaymentSchema.safeParse(body);

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

    const payment = await billingService.processPayment(
      validation.data.invoiceId,
      validation.data.paymentMethod,
      validation.data.gatewayTransactionId
    );

    // TODO: Integrate with actual payment gateway (Midtrans/Xendit)
    // For now, automatically mark as paid for demonstration
    await billingService.markPaymentPaid(payment.id);

    return NextResponse.json({
      success: true,
      data: { payment },
      message: 'Payment processed successfully',
      messageIndonesian: 'Pembayaran berhasil diproses'
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Process Payment API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
