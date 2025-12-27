/**
 * Sales Invoice API
 * GET /api/v1/sales-invoices - List invoices
 * POST /api/v1/sales-invoices - Create invoice
 *
 * Protected: Requires authentication + finance/admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

// Minimum role level to access invoice features
const MIN_ROLE_LEVEL = 60; // FINANCE and above

/**
 * Generate sequential invoice number
 * Format: INV/TENANTCODE/YYYY/MM/0001
 */
async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get tenant code (first 3 chars of slug or ID)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  const tenantCode = (tenant?.slug || tenantId).substring(0, 3).toUpperCase();

  // Get last invoice number for this month
  const prefix = `INV/${tenantCode}/${year}/${month}/`;
  const lastInvoice = await prisma.salesInvoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: 'desc' },
  });

  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('/').pop() || '0');
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Calculate credit/leasing details
 */
function calculateCredit(
  principal: number,
  tenor: number,
  interestRate: number,
  interestType: string = 'flat'
): { monthlyInstallment: number; totalInterest: number; totalPayment: number } {
  if (interestType === 'flat') {
    // Flat interest: interest calculated on original principal
    const totalInterest = (principal * interestRate * tenor) / 100 / 12;
    const totalPayment = principal + totalInterest;
    const monthlyInstallment = totalPayment / tenor;
    return { monthlyInstallment, totalInterest, totalPayment };
  } else {
    // Effective interest (reducing balance) - simplified calculation
    const monthlyRate = interestRate / 100 / 12;
    const monthlyInstallment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenor)) /
      (Math.pow(1 + monthlyRate, tenor) - 1);
    const totalPayment = monthlyInstallment * tenor;
    const totalInterest = totalPayment - principal;
    return { monthlyInstallment, totalInterest, totalPayment };
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = auth.user.tenantId;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const where: any = { tenantId };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { vehicleMake: { contains: search, mode: 'insensitive' } },
        { vehicleModel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total, stats] = await Promise.all([
      prisma.salesInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          payments: { select: { amount: true, receivedAt: true } },
          creditDetail: { select: { tenor: true, monthlyInstallment: true } },
        },
      }),
      prisma.salesInvoice.count({ where }),
      prisma.salesInvoice.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
        _sum: { grandTotal: true },
      }),
    ]);

    // Transform stats to expected format
    const statsMap = stats.reduce(
      (acc, s) => {
        acc[s.status] = { count: s._count, total: Number(s._sum.grandTotal) || 0 };
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    const transformedStats = {
      total: Object.values(statsMap).reduce((sum, s) => sum + s.count, 0),
      totalAmount: Object.values(statsMap).reduce((sum, s) => sum + s.total, 0),
      unpaid: statsMap['unpaid']?.count || 0,
      unpaidAmount: statsMap['unpaid']?.total || 0,
      partial: statsMap['partial']?.count || 0,
      partialAmount: statsMap['partial']?.total || 0,
      paid: statsMap['paid']?.count || 0,
      paidAmount: statsMap['paid']?.total || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: transformedStats,
      },
    });
  } catch (error) {
    console.error('[Sales Invoice API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const userRoleLevel = (auth.user as any).roleLevel || 30;
  if (userRoleLevel < MIN_ROLE_LEVEL) {
    return NextResponse.json({ error: 'Forbidden - Finance access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const tenantId = auth.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const {
      customerId,
      vehicleId,
      salesUserId,
      dueDate,
      // Vehicle details
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehiclePlateNumber,
      vehicleFrameNumber,
      vehicleEngineNumber,
      vehicleMileage,
      // Pricing
      vehiclePrice,
      discountAmount,
      discountNote,
      adminFee,
      transferFee,
      otherFee,
      otherFeeNote,
      // Payment
      paymentMethod,
      // Credit details (if credit)
      creditDetail,
      // Notes
      notes,
      termsConditions,
    } = body;

    if (!customerId || !vehiclePrice) {
      return NextResponse.json({ error: 'Customer and vehicle price are required' }, { status: 400 });
    }

    // Calculate totals
    const price = parseFloat(vehiclePrice) || 0;
    const discount = parseFloat(discountAmount) || 0;
    const admin = parseFloat(adminFee) || 0;
    const transfer = parseFloat(transferFee) || 0;
    const other = parseFloat(otherFee) || 0;

    const dpp = price - discount;
    const grandTotal = dpp + admin + transfer + other;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tenantId);

    // Create invoice
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId,
        invoiceNumber,
        customerId,
        vehicleId,
        salesUserId,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        // Vehicle details
        vehicleMake,
        vehicleModel,
        vehicleYear: vehicleYear ? parseInt(vehicleYear) : null,
        vehicleColor,
        vehiclePlateNumber,
        vehicleFrameNumber,
        vehicleEngineNumber,
        vehicleMileage: vehicleMileage ? parseInt(vehicleMileage) : null,
        // Pricing
        vehiclePrice: price,
        discountAmount: discount,
        discountNote,
        dpp,
        adminFee: admin,
        transferFee: transfer,
        otherFee: other,
        otherFeeNote,
        grandTotal,
        // Payment
        paymentMethod: paymentMethod || 'cash',
        status: 'draft',
        // Notes
        notes,
        termsConditions,
        // Audit
        createdBy: auth.user.id,
      },
      include: {
        customer: true,
      },
    });

    // If credit payment, create credit detail
    if (paymentMethod === 'credit' && creditDetail) {
      const { leasingPartnerId, dpAmount, dpPercent, tenor, interestRate, interestType } = creditDetail;

      const dp = parseFloat(dpAmount) || 0;
      const principal = grandTotal - dp;
      const calculated = calculateCredit(principal, tenor, interestRate, interestType);

      await prisma.salesInvoiceCreditDetail.create({
        data: {
          invoiceId: invoice.id,
          leasingPartnerId,
          dpAmount: dp,
          dpPercent: dpPercent || (dp / grandTotal) * 100,
          principalAmount: principal,
          tenor,
          interestRate,
          interestType: interestType || 'flat',
          monthlyInstallment: calculated.monthlyInstallment,
          totalInterest: calculated.totalInterest,
          totalPayment: calculated.totalPayment,
        },
      });
    }

    // Create audit log
    await prisma.salesInvoiceAuditLog.create({
      data: {
        invoiceId: invoice.id,
        action: 'create',
        newValue: JSON.stringify({ invoiceNumber, grandTotal, status: 'draft' }),
        performedBy: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    console.error('[Sales Invoice API] Create error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
