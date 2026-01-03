/**
 * Invoice PDF Export API
 * GET /api/v1/sales-invoices/[id]/export
 *
 * Generates PDF invoice document
 * Restricted to MANAGER (70+) and above
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

// Minimum role level to export (MANAGER and above)
const MIN_EXPORT_ROLE_LEVEL = 70;

// Format currency
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format date
function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    const { id } = await params;
    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const roleLevel = user.roleLevel || 30;

    // Check role level
    if (roleLevel < MIN_EXPORT_ROLE_LEVEL) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to export' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId!;

    // Get invoice with relations
    const invoice = await prisma.salesInvoice.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        customer: true,
        payments: {
          orderBy: { paymentNumber: 'asc' },
        },
        creditDetail: {
          include: {
            leasingPartner: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get tenant info for header
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: tenant?.name || 'AutoLumiKu',
      },
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Wait for PDF generation to complete
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // === PDF Content ===

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(tenant?.name || 'INVOICE', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Showroom Mobil Bekas Berkualitas', { align: 'center' });
    doc.moveDown(0.5);

    // Invoice number and date
    doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(invoice.invoiceNumber, { align: 'center' });
    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Two columns: Customer Info & Invoice Info
    const startY = doc.y;

    // Left column - Customer
    doc.fontSize(10).font('Helvetica-Bold').text('KEPADA:', 50);
    doc.font('Helvetica');
    doc.text(invoice.customer?.name || '-', 50);
    doc.text(invoice.customer?.phone || '', 50);
    if (invoice.customer?.address) {
      doc.text(invoice.customer.address, 50, undefined, { width: 200 });
    }
    if (invoice.customer?.nik) {
      doc.text(`NIK: ${invoice.customer.nik}`, 50);
    }

    // Right column - Invoice details
    doc.fontSize(10).font('Helvetica-Bold').text('TANGGAL:', 350, startY);
    doc.font('Helvetica').text(formatDate(invoice.invoiceDate), 420, startY);

    doc.font('Helvetica-Bold').text('JATUH TEMPO:', 350);
    doc.font('Helvetica').text(formatDate(invoice.dueDate), 420);

    doc.font('Helvetica-Bold').text('STATUS:', 350);
    const statusLabels: Record<string, string> = {
      draft: 'Draft',
      unpaid: 'Belum Bayar',
      partial: 'Sebagian',
      paid: 'Lunas',
      void: 'Batal',
    };
    doc.font('Helvetica').text(statusLabels[invoice.status] || invoice.status, 420);

    doc.y = Math.max(doc.y, startY + 80);
    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Vehicle Details
    doc.fontSize(12).font('Helvetica-Bold').text('DETAIL KENDARAAN');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    const vehicleName = `${invoice.vehicleMake || ''} ${invoice.vehicleModel || ''} (${invoice.vehicleYear || '-'})`;
    doc.text(`Kendaraan: ${vehicleName}`);
    doc.text(`Warna: ${invoice.vehicleColor || '-'}`);
    doc.text(`No. Polisi: ${invoice.vehiclePlateNumber || '-'}`);
    doc.text(`No. Rangka: ${invoice.vehicleFrameNumber || '-'}`);
    doc.text(`No. Mesin: ${invoice.vehicleEngineNumber || '-'}`);
    if (invoice.vehicleMileage) {
      doc.text(`Kilometer: ${invoice.vehicleMileage.toLocaleString()} KM`);
    }
    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Pricing Table
    doc.fontSize(12).font('Helvetica-Bold').text('RINCIAN HARGA');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('DESKRIPSI', 50, tableTop, { width: 300 });
    doc.text('JUMLAH', 400, tableTop, { width: 145, align: 'right' });

    doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke();
    doc.moveDown(0.5);

    // Table rows
    doc.font('Helvetica');

    // Vehicle price
    doc.text('Harga Kendaraan', 50);
    doc.text(formatRupiah(Number(invoice.vehiclePrice)), 400, doc.y - 12, { width: 145, align: 'right' });

    // Discount
    if (Number(invoice.discountAmount) > 0) {
      doc.text(`Diskon${invoice.discountNote ? ` (${invoice.discountNote})` : ''}`, 50);
      doc.text(`-${formatRupiah(Number(invoice.discountAmount))}`, 400, doc.y - 12, { width: 145, align: 'right' });
    }

    // DPP
    doc.text('DPP (Dasar Pengenaan Pajak)', 50);
    doc.text(formatRupiah(Number(invoice.dpp)), 400, doc.y - 12, { width: 145, align: 'right' });

    // Admin fee
    if (Number(invoice.adminFee) > 0) {
      doc.text('Biaya Administrasi', 50);
      doc.text(formatRupiah(Number(invoice.adminFee)), 400, doc.y - 12, { width: 145, align: 'right' });
    }

    // Transfer fee
    if (Number(invoice.transferFee) > 0) {
      doc.text('Biaya Balik Nama', 50);
      doc.text(formatRupiah(Number(invoice.transferFee)), 400, doc.y - 12, { width: 145, align: 'right' });
    }

    // Other fee
    if (Number(invoice.otherFee) > 0) {
      doc.text(`Biaya Lain-lain${invoice.otherFeeNote ? ` (${invoice.otherFeeNote})` : ''}`, 50);
      doc.text(formatRupiah(Number(invoice.otherFee)), 400, doc.y - 12, { width: 145, align: 'right' });
    }

    // Total line
    doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('GRAND TOTAL', 50);
    doc.text(formatRupiah(Number(invoice.grandTotal)), 400, doc.y - 14, { width: 145, align: 'right' });
    doc.moveDown();

    // Payment summary
    doc.fontSize(10).font('Helvetica');
    doc.text(`Terbayar: ${formatRupiah(Number(invoice.paidAmount))}`, 350);
    const remaining = Number(invoice.grandTotal) - Number(invoice.paidAmount);
    doc.text(`Sisa: ${formatRupiah(remaining)}`, 350);
    doc.moveDown();

    // Credit details if applicable
    if (invoice.paymentMethod === 'credit' && invoice.creditDetail) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(12).font('Helvetica-Bold').text('DETAIL KREDIT');
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Leasing: ${invoice.creditDetail.leasingPartner?.name || '-'}`);
      doc.text(`DP: ${formatRupiah(Number(invoice.creditDetail.dpAmount))} (${invoice.creditDetail.dpPercent}%)`);
      doc.text(`Pokok Hutang: ${formatRupiah(Number(invoice.creditDetail.principalAmount))}`);
      doc.text(`Tenor: ${invoice.creditDetail.tenor} bulan`);
      doc.text(`Bunga: ${invoice.creditDetail.interestRate}% (${invoice.creditDetail.interestType})`);
      doc.text(`Angsuran: ${formatRupiah(Number(invoice.creditDetail.monthlyInstallment))}/bulan`);
      doc.moveDown();
    }

    // Payment history
    if (invoice.payments && invoice.payments.length > 0) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(12).font('Helvetica-Bold').text('RIWAYAT PEMBAYARAN');
      doc.moveDown(0.5);

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('NO', 50, doc.y, { width: 30 });
      doc.text('TANGGAL', 80, doc.y - 12, { width: 100 });
      doc.text('METODE', 180, doc.y - 12, { width: 100 });
      doc.text('JUMLAH', 350, doc.y - 12, { width: 145, align: 'right' });

      doc.moveTo(50, doc.y + 3).lineTo(545, doc.y + 3).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica');
      invoice.payments.forEach((payment, idx) => {
        const methodLabels: Record<string, string> = {
          cash: 'Tunai',
          transfer: 'Transfer',
          check: 'Cek/Giro',
          leasing_disbursement: 'Pencairan Leasing',
        };
        doc.text(String(idx + 1), 50, doc.y, { width: 30 });
        doc.text(formatDate(payment.receivedAt), 80, doc.y - 12, { width: 100 });
        doc.text(methodLabels[payment.method] || payment.method, 180, doc.y - 12, { width: 100 });
        doc.text(formatRupiah(Number(payment.amount)), 350, doc.y - 12, { width: 145, align: 'right' });
      });
      doc.moveDown();
    }

    // Notes
    if (invoice.notes) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(10).font('Helvetica-Bold').text('CATATAN:');
      doc.font('Helvetica').text(invoice.notes, { width: 495 });
      doc.moveDown();
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
    doc.text('Dokumen ini digenerate secara otomatis oleh sistem AutoLumiKu', { align: 'center' });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await pdfPromise;

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Invoice Export] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
