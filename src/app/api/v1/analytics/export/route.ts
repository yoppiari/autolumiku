/**
 * POST /api/v1/analytics/export - Export Analytics Report
 *
 * Protected: Requires ADMIN+ role (roleLevel >= 90)
 * Exports analytics report to PDF or Excel format
 *
 * Query params:
 * - format: 'pdf' | 'excel' (default: 'pdf')
 * - department: 'sales' | 'finance' | 'all' (default: 'all')
 * - period: 'monthly' | 'quarterly' | 'yearly' (default: 'monthly')
 * - timeRange: '7d' | '30d' | '90d' | '1y' (default: '30d')
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

// Helper to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Helper to format date
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export async function POST(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // RBAC: Require ADMIN+ role (roleLevel >= 90)
  // Per access matrix: Admin, Owner, Super Admin can access
  if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
    return NextResponse.json(
      { error: 'Forbidden - Admin role or higher required for analytics export' },
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
    const format = searchParams.get('format') || 'pdf';
    const department = searchParams.get('department') || 'all';
    const period = searchParams.get('period') || 'monthly';
    const timeRange = searchParams.get('timeRange') || '30d';

    // Validate format
    if (format !== 'pdf' && format !== 'excel') {
      return NextResponse.json(
        { error: 'Invalid format. Use "pdf" or "excel"' },
        { status: 400 }
      );
    }

    // Excel export requires xlsx library (not installed)
    if (format === 'excel') {
      return NextResponse.json(
        { error: 'Excel export is not yet available. Please use PDF format.' },
        { status: 501 }
      );
    }

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

    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });

    // Gather analytics data based on department
    let salesData = null;
    let financeData = null;

    if (department === 'sales' || department === 'all') {
      // Get sold vehicles
      const soldVehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'SOLD',
          updatedAt: { gte: startDate },
        },
        select: {
          make: true,
          model: true,
          year: true,
          price: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
      const totalSalesCount = soldVehicles.length;

      // Vehicles by make
      const byMake: Record<string, { count: number; value: number }> = {};
      soldVehicles.forEach((v) => {
        const make = v.make || 'Other';
        if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
        byMake[make].count++;
        byMake[make].value += Number(v.price);
      });

      salesData = {
        summary: { totalSalesCount, totalSalesValue },
        vehicles: soldVehicles.map((v) => ({
          ...v,
          price: Number(v.price),
        })),
        byMake: Object.entries(byMake).map(([make, data]) => ({
          make,
          ...data,
        })),
      };
    }

    if (department === 'finance' || department === 'all') {
      // Get invoice data
      const invoices = await prisma.salesInvoice.findMany({
        where: { tenantId },
        select: {
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          paidAmount: true,
          dueDate: true,
        },
      });

      const summary = {
        total: invoices.length,
        draft: 0,
        unpaid: 0,
        partial: 0,
        paid: 0,
        voided: 0,
        totalValue: 0,
        collected: 0,
        outstanding: 0,
      };

      invoices.forEach((inv) => {
        const total = Number(inv.grandTotal);
        const paid = Number(inv.paidAmount || 0);

        switch (inv.status) {
          case 'draft':
            summary.draft++;
            break;
          case 'unpaid':
          case 'sent':
            summary.unpaid++;
            summary.totalValue += total;
            summary.outstanding += total;
            break;
          case 'partial':
            summary.partial++;
            summary.totalValue += total;
            summary.collected += paid;
            summary.outstanding += total - paid;
            break;
          case 'paid':
            summary.paid++;
            summary.totalValue += total;
            summary.collected += total;
            break;
          case 'void':
            summary.voided++;
            break;
        }
      });

      financeData = { summary };
    }

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    // Cover page
    doc.fontSize(24).font('Helvetica-Bold').text('Laporan Analytics', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Periode: ${formatDate(startDate)} - ${formatDate(now)}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#666666')
      .text(`Dibuat pada: ${formatDate(now)}`, { align: 'center' });
    doc.moveDown(2);

    // Add department name
    const deptName = department === 'all' ? 'Seluruh Departemen'
      : department === 'sales' ? 'Departemen Sales'
        : 'Departemen Finance/Accounting';
    doc.fontSize(14).fillColor('#000000').text(deptName, { align: 'center' });

    // Sales section
    if (salesData) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('Laporan Penjualan', { underline: true });
      doc.moveDown();

      // Summary
      doc.fontSize(12).font('Helvetica');
      doc.text(`Total Penjualan: ${salesData.summary.totalSalesCount} unit`);
      doc.text(`Total Nilai: ${formatCurrency(salesData.summary.totalSalesValue)}`);

      if (salesData.summary.totalSalesCount > 0) {
        const avg = salesData.summary.totalSalesValue / salesData.summary.totalSalesCount;
        doc.text(`Rata-rata per Unit: ${formatCurrency(avg)}`);
      }

      doc.moveDown();

      // By Make
      doc.fontSize(14).font('Helvetica-Bold').text('Penjualan per Merek:');
      doc.moveDown(0.5);

      salesData.byMake.forEach((item) => {
        doc.fontSize(11).font('Helvetica');
        doc.text(`${item.make}: ${item.count} unit (${formatCurrency(item.value)})`);
      });

      doc.moveDown();

      // Recent sales table header
      if (salesData.vehicles.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Transaksi Terbaru:');
        doc.moveDown(0.5);

        salesData.vehicles.slice(0, 10).forEach((v, idx) => {
          doc.fontSize(10).font('Helvetica');
          doc.text(`${idx + 1}. ${v.make} ${v.model} (${v.year}) - ${formatCurrency(v.price)}`);
        });
      }
    }

    // Finance section
    if (financeData) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('Laporan Keuangan', { underline: true });
      doc.moveDown();

      // Summary
      doc.fontSize(12).font('Helvetica');
      doc.text(`Total Invoice: ${financeData.summary.total}`);
      doc.text(`Draft: ${financeData.summary.draft}`);
      doc.text(`Belum Dibayar: ${financeData.summary.unpaid}`);
      doc.text(`Dibayar Sebagian: ${financeData.summary.partial}`);
      doc.text(`Lunas: ${financeData.summary.paid}`);
      doc.text(`Batal: ${financeData.summary.voided}`);

      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Ringkasan Pembayaran:');
      doc.moveDown(0.5);

      doc.fontSize(12).font('Helvetica');
      doc.text(`Total Nilai Faktur: ${formatCurrency(financeData.summary.totalValue)}`);
      doc.text(`Total Terkumpul: ${formatCurrency(financeData.summary.collected)}`);
      doc.text(`Piutang Beredar: ${formatCurrency(financeData.summary.outstanding)}`);

      if (financeData.summary.totalValue > 0) {
        const rate = (financeData.summary.collected / financeData.summary.totalValue) * 100;
        doc.text(`Tingkat Penagihan: ${rate.toFixed(1)}%`);
      }
    }

    // Footer
    doc.addPage();
    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text('Laporan ini dibuat secara otomatis oleh sistem AutoLumiKu.', { align: 'center' });
    doc.text('Untuk pertanyaan, hubungi tim support.', { align: 'center' });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    await new Promise<void>((resolve) => {
      doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(chunks);

    // Generate filename
    const filename = `analytics-${department}-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
