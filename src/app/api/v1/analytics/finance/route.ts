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

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '30d';
    const period = searchParams.get('period') || 'monthly';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get all invoices for the tenant
    const invoices = await prisma.salesInvoice.findMany({
      where: { tenantId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        grandTotal: true,
        paidAmount: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get customer data separately
    const customers = await prisma.salesCustomer.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const customerMap = new Map(customers.map(c => [c.id, c.name]));

    // Invoice summary by status
    const invoiceSummary = {
      draft: { count: 0, value: 0 },
      unpaid: { count: 0, value: 0 },
      partialPaid: { count: 0, value: 0, paidValue: 0 },
      paid: { count: 0, value: 0 },
      voided: { count: 0, value: 0 },
      overdue: { count: 0, value: 0 },
    };

    const overdueInvoices: typeof invoices = [];

    invoices.forEach((invoice) => {
      const grandTotal = Number(invoice.grandTotal);
      const paidAmount = Number(invoice.paidAmount || 0);

      switch (invoice.status) {
        case 'draft':
          invoiceSummary.draft.count++;
          invoiceSummary.draft.value += grandTotal;
          break;
        case 'unpaid':
        case 'sent':
          invoiceSummary.unpaid.count++;
          invoiceSummary.unpaid.value += grandTotal;
          // Check if overdue
          if (invoice.dueDate && new Date(invoice.dueDate) < now) {
            invoiceSummary.overdue.count++;
            invoiceSummary.overdue.value += grandTotal;
            overdueInvoices.push(invoice);
          }
          break;
        case 'partial':
          invoiceSummary.partialPaid.count++;
          invoiceSummary.partialPaid.value += grandTotal;
          invoiceSummary.partialPaid.paidValue += paidAmount;
          // Check if overdue
          if (invoice.dueDate && new Date(invoice.dueDate) < now) {
            invoiceSummary.overdue.count++;
            invoiceSummary.overdue.value += grandTotal - paidAmount;
            overdueInvoices.push(invoice);
          }
          break;
        case 'paid':
          invoiceSummary.paid.count++;
          invoiceSummary.paid.value += grandTotal;
          break;
        case 'void':
          invoiceSummary.voided.count++;
          invoiceSummary.voided.value += grandTotal;
          break;
      }
    });

    // Payment collection rate
    const totalBilled = invoiceSummary.unpaid.value +
      invoiceSummary.partialPaid.value +
      invoiceSummary.paid.value;

    const totalCollected = invoiceSummary.paid.value +
      invoiceSummary.partialPaid.paidValue;

    const collectionRate = totalBilled > 0
      ? ((totalCollected / totalBilled) * 100).toFixed(1)
      : '0.0';

    // Outstanding receivables (unpaid + partial remaining)
    const outstandingReceivables = invoiceSummary.unpaid.value +
      (invoiceSummary.partialPaid.value - invoiceSummary.partialPaid.paidValue);

    // Get payments in period
    const payments = await prisma.salesInvoicePayment.findMany({
      where: {
        invoice: { tenantId },
        receivedAt: { gte: startDate },
      },
      select: {
        id: true,
        amount: true,
        method: true,
        receivedAt: true,
      },
    });

    const totalPaymentsReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Payments by method
    const paymentsByMethod = payments.reduce((acc: Record<string, { count: number; value: number }>, p) => {
      const method = p.method || 'OTHER';
      if (!acc[method]) {
        acc[method] = { count: 0, value: 0 };
      }
      acc[method].count++;
      acc[method].value += Number(p.amount);
      return acc;
    }, {});

    // Cash flow trend (group by day/week/month)
    const cashFlowTrend: { date: string; received: number; invoiced: number }[] = [];
    const cashFlowMap: Record<string, { received: number; invoiced: number }> = {};

    // Group payments by date
    payments.forEach((p) => {
      const date = new Date(p.receivedAt);
      let dateKey: string;

      if (period === 'daily' || timeRange === '7d') {
        dateKey = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!cashFlowMap[dateKey]) {
        cashFlowMap[dateKey] = { received: 0, invoiced: 0 };
      }
      cashFlowMap[dateKey].received += Number(p.amount);
    });

    // Group invoices by date
    invoices.forEach((inv) => {
      if (inv.status !== 'draft' && inv.status !== 'void') {
        const date = new Date(inv.createdAt);
        if (date >= startDate) {
          let dateKey: string;

          if (period === 'daily' || timeRange === '7d') {
            dateKey = date.toISOString().split('T')[0];
          } else if (period === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            dateKey = weekStart.toISOString().split('T')[0];
          } else {
            dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          }

          if (!cashFlowMap[dateKey]) {
            cashFlowMap[dateKey] = { received: 0, invoiced: 0 };
          }
          cashFlowMap[dateKey].invoiced += Number(inv.grandTotal);
        }
      }
    });

    Object.entries(cashFlowMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        cashFlowTrend.push({ date, ...data });
      });

    // Top outstanding invoices (for receivables table)
    const topReceivables = invoices
      .filter((inv) => inv.status === 'unpaid' || inv.status === 'sent' || inv.status === 'partial')
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount || 0),
        outstanding: Number(inv.grandTotal) - Number(inv.paidAmount || 0),
        dueDate: inv.dueDate,
        isOverdue: inv.dueDate ? new Date(inv.dueDate) < now : false,
        daysPastDue: inv.dueDate
          ? Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
      }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    // Aging buckets for receivables
    const agingBuckets = {
      current: { count: 0, value: 0 },
      days1to30: { count: 0, value: 0 },
      days31to60: { count: 0, value: 0 },
      days61to90: { count: 0, value: 0 },
      over90: { count: 0, value: 0 },
    };

    invoices
      .filter((inv) => inv.status === 'unpaid' || inv.status === 'sent' || inv.status === 'partial')
      .forEach((inv) => {
        const outstanding = Number(inv.grandTotal) - Number(inv.paidAmount || 0);
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPastDue <= 0) {
          agingBuckets.current.count++;
          agingBuckets.current.value += outstanding;
        } else if (daysPastDue <= 30) {
          agingBuckets.days1to30.count++;
          agingBuckets.days1to30.value += outstanding;
        } else if (daysPastDue <= 60) {
          agingBuckets.days31to60.count++;
          agingBuckets.days31to60.value += outstanding;
        } else if (daysPastDue <= 90) {
          agingBuckets.days61to90.count++;
          agingBuckets.days61to90.value += outstanding;
        } else {
          agingBuckets.over90.count++;
          agingBuckets.over90.value += outstanding;
        }
      });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalInvoices: invoices.length,
          totalBilled,
          totalCollected,
          outstandingReceivables,
          collectionRate: parseFloat(collectionRate),
          overdueCount: invoiceSummary.overdue.count,
          overdueValue: invoiceSummary.overdue.value,
        },
        invoiceBreakdown: [
          { status: 'Draft', count: invoiceSummary.draft.count, value: invoiceSummary.draft.value },
          { status: 'Unpaid', count: invoiceSummary.unpaid.count, value: invoiceSummary.unpaid.value },
          { status: 'Partial', count: invoiceSummary.partialPaid.count, value: invoiceSummary.partialPaid.value },
          { status: 'Paid', count: invoiceSummary.paid.count, value: invoiceSummary.paid.value },
          { status: 'Voided', count: invoiceSummary.voided.count, value: invoiceSummary.voided.value },
        ],
        paymentMethods: Object.entries(paymentsByMethod).map(([method, data]) => ({
          method,
          ...data,
        })),
        cashFlowTrend,
        agingBuckets: [
          { bucket: 'Current', ...agingBuckets.current },
          { bucket: '1-30 Days', ...agingBuckets.days1to30 },
          { bucket: '31-60 Days', ...agingBuckets.days31to60 },
          { bucket: '61-90 Days', ...agingBuckets.days61to90 },
          { bucket: '90+ Days', ...agingBuckets.over90 },
        ],
        topReceivables,
        paymentsInPeriod: {
          count: payments.length,
          value: totalPaymentsReceived,
        },
        timeRange,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        generated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Finance analytics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch finance analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
