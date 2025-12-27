/**
 * Sales Invoice Detail API
 * GET /api/v1/sales-invoices/[id] - Get invoice details
 * PUT /api/v1/sales-invoices/[id] - Update invoice
 * DELETE /api/v1/sales-invoices/[id] - Void invoice
 *
 * Protected: Requires authentication + finance/admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

const MIN_ROLE_LEVEL = 60; // FINANCE and above
const MIN_ROLE_LEVEL_VOID = 70; // MANAGER and above can void

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

    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        payments: { orderBy: { paymentNumber: 'asc' } },
        creditDetail: { include: { leasingPartner: true } },
        commission: true,
        auditLogs: { orderBy: { performedAt: 'desc' }, take: 20 },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[Sales Invoice API] Get error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PUT(
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
    const body = await request.json();

    // Check if invoice exists and is editable
    const existing = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Can't edit locked (paid) invoices
    if (existing.lockedAt) {
      return NextResponse.json({ error: 'Cannot edit locked invoice' }, { status: 400 });
    }

    // Can't edit voided invoices
    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Cannot edit voided invoice' }, { status: 400 });
    }

    const {
      dueDate,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehiclePlateNumber,
      vehicleFrameNumber,
      vehicleEngineNumber,
      vehicleMileage,
      vehiclePrice,
      discountAmount,
      discountNote,
      adminFee,
      transferFee,
      otherFee,
      otherFeeNote,
      notes,
      termsConditions,
    } = body;

    // Recalculate totals
    const price = parseFloat(vehiclePrice) || existing.vehiclePrice;
    const discount = parseFloat(discountAmount) || existing.discountAmount;
    const admin = parseFloat(adminFee) || existing.adminFee;
    const transfer = parseFloat(transferFee) || existing.transferFee;
    const other = parseFloat(otherFee) || existing.otherFee;

    const dpp = price - discount;
    const grandTotal = dpp + admin + transfer + other;

    // Track changes for audit
    const changes: string[] = [];
    if (vehiclePrice !== existing.vehiclePrice) changes.push('vehiclePrice');
    if (discountAmount !== existing.discountAmount) changes.push('discountAmount');

    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
        vehicleMake: vehicleMake ?? existing.vehicleMake,
        vehicleModel: vehicleModel ?? existing.vehicleModel,
        vehicleYear: vehicleYear ? parseInt(vehicleYear) : existing.vehicleYear,
        vehicleColor: vehicleColor ?? existing.vehicleColor,
        vehiclePlateNumber: vehiclePlateNumber ?? existing.vehiclePlateNumber,
        vehicleFrameNumber: vehicleFrameNumber ?? existing.vehicleFrameNumber,
        vehicleEngineNumber: vehicleEngineNumber ?? existing.vehicleEngineNumber,
        vehicleMileage: vehicleMileage ? parseInt(vehicleMileage) : existing.vehicleMileage,
        vehiclePrice: price,
        discountAmount: discount,
        discountNote: discountNote ?? existing.discountNote,
        dpp,
        adminFee: admin,
        transferFee: transfer,
        otherFee: other,
        otherFeeNote: otherFeeNote ?? existing.otherFeeNote,
        grandTotal,
        notes: notes ?? existing.notes,
        termsConditions: termsConditions ?? existing.termsConditions,
        updatedBy: auth.user.id,
      },
      include: { customer: true },
    });

    // Create audit log
    await prisma.salesInvoiceAuditLog.create({
      data: {
        invoiceId: id,
        action: 'update',
        field: changes.join(','),
        oldValue: JSON.stringify({ grandTotal: existing.grandTotal }),
        newValue: JSON.stringify({ grandTotal }),
        performedBy: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    console.error('[Sales Invoice API] Update error:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL_VOID) {
    return NextResponse.json({ error: 'Forbidden - Manager access required to void' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const body = await request.json().catch(() => ({}));
    const { voidReason } = body;

    const existing = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Invoice already voided' }, { status: 400 });
    }

    // Void the invoice (soft delete)
    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        status: 'void',
        voidReason: voidReason || 'Voided by manager',
        voidedAt: new Date(),
        voidedBy: auth.user.id,
      },
    });

    // Create audit log
    await prisma.salesInvoiceAuditLog.create({
      data: {
        invoiceId: id,
        action: 'void',
        oldValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: 'void', voidReason }),
        performedBy: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice voided successfully',
    });
  } catch (error) {
    console.error('[Sales Invoice API] Delete error:', error);
    return NextResponse.json({ error: 'Failed to void invoice' }, { status: 500 });
  }
}
