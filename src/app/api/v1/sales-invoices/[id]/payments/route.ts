/**
 * Sales Invoice Payments API
 * GET /api/v1/sales-invoices/[id]/payments - List payments
 * POST /api/v1/sales-invoices/[id]/payments - Add payment
 *
 * Protected: Requires authentication + finance/admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

const MIN_ROLE_LEVEL = 60; // FINANCE and above

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const tenantId = auth.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Verify invoice belongs to tenant
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true, grandTotal: true, paidAmount: true, status: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payments = await prisma.salesInvoicePayment.findMany({
      where: { invoiceId: id },
      orderBy: { paymentNumber: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        payments,
        summary: {
          grandTotal: invoice.grandTotal,
          paidAmount: invoice.paidAmount,
          remainingAmount: invoice.grandTotal - invoice.paidAmount,
          status: invoice.status,
        },
      },
    });
  } catch (error) {
    console.error('[Sales Invoice Payments API] Get error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const tenantId = auth.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const body = await request.json();

    const {
      amount,
      method,
      paymentType,
      bankName,
      accountNumber,
      referenceNumber,
      proofUrl,
      notes,
      receivedAt,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    // Get invoice and verify
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'Cannot add payment to voided invoice' }, { status: 400 });
    }

    // Get next payment number
    const lastPayment = await prisma.salesInvoicePayment.findFirst({
      where: { invoiceId: id },
      orderBy: { paymentNumber: 'desc' },
    });
    const paymentNumber = (lastPayment?.paymentNumber || 0) + 1;

    // Calculate new paid amount
    const newPaidAmount = invoice.paidAmount + parseFloat(amount);
    const remaining = invoice.grandTotal - newPaidAmount;

    // Determine new status
    let newStatus = invoice.status;
    if (newPaidAmount >= invoice.grandTotal) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    // Create payment and update invoice in transaction
    const [payment] = await prisma.$transaction([
      prisma.salesInvoicePayment.create({
        data: {
          invoiceId: id,
          paymentNumber,
          amount: parseFloat(amount),
          method: method || 'transfer',
          paymentType: paymentType || 'regular',
          bankName,
          accountNumber,
          referenceNumber,
          proofUrl,
          notes,
          receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
          receivedBy: auth.user.id,
        },
      }),
      prisma.salesInvoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          lockedAt: newStatus === 'paid' ? new Date() : undefined,
          updatedBy: auth.user.id,
        },
      }),
      prisma.salesInvoiceAuditLog.create({
        data: {
          invoiceId: id,
          action: 'payment',
          field: 'paidAmount',
          oldValue: JSON.stringify({ paidAmount: invoice.paidAmount, status: invoice.status }),
          newValue: JSON.stringify({ paidAmount: newPaidAmount, status: newStatus, paymentNumber }),
          performedBy: auth.user.id,
        },
      }),
    ]);

    // If fully paid and has sales user, create commission
    if (newStatus === 'paid' && invoice.salesUserId) {
      // Get commission config
      const commissionConfig = await prisma.commissionConfig.findFirst({
        where: { tenantId, isActive: true },
      });

      if (commissionConfig) {
        let commissionAmount = 0;
        let rate: number | null = null;

        if (commissionConfig.type === 'fixed') {
          commissionAmount = commissionConfig.fixedAmount;
        } else if (commissionConfig.type === 'percentage_price' && commissionConfig.percentageRate) {
          rate = commissionConfig.percentageRate;
          commissionAmount = (invoice.grandTotal * rate) / 100;
        }

        // Create commission record
        await prisma.salesCommission.create({
          data: {
            tenantId,
            invoiceId: id,
            salesUserId: invoice.salesUserId,
            calculationType: commissionConfig.type,
            baseAmount: invoice.grandTotal,
            rate,
            commissionAmount,
            bonusAmount: 0,
            totalAmount: commissionAmount,
            status: 'pending',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        payment,
        invoiceStatus: newStatus,
        paidAmount: newPaidAmount,
        remainingAmount: remaining > 0 ? remaining : 0,
      },
      message: 'Payment recorded successfully',
    });
  } catch (error) {
    console.error('[Sales Invoice Payments API] Create error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
