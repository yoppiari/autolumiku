/**
 * Manual PDF Trigger Endpoint
 * POST /api/v1/debug/send-pdf
 * Body: { "phone": "...", "reportType": "..." }
 *
 * This bypasses WhatsApp AI and directly generates + sends PDF
 * Available report types:
 * - sales-summary
 * - operational-metrics
 * - low-stock-alert
 * - customer-metrics
 * - staff-performance
 * - recent-sales
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PDFKit = require('pdfkit');

async function generateOperationalMetricsPDF(): Promise<{ pdfBuffer: Buffer; filename: string }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve({
      pdfBuffer: Buffer.concat(chunks),
      filename: 'Operational-Metrics.pdf'
    }));
    doc.on('error', reject);

    doc.fontSize(20).text('Operational Metrics Report', { align: 'center' });
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString('id-ID')}\n`);
    doc.moveDown();
    doc.text('This is a test PDF from production.');
    doc.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, reportType = 'operational-metrics' } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findFirst({
      where: {
        phone: phone,
        roleLevel: { gte: 90 } // Owner/Admin only
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        roleLevel: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found or not authorized" },
        { status: 404 }
      );
    }

    console.log(`[Manual PDF] User: ${user.firstName} ${user.lastName} (${user.role})`);
    console.log(`[Manual PDF] Report: ${reportType}`);

    // Generate PDF
    const { pdfBuffer, filename } = await generateOperationalMetricsPDF();

    console.log(`[Manual PDF] Generated: ${filename}, size: ${pdfBuffer.length} bytes`);

    // Return base64 PDF
    return NextResponse.json({
      success: true,
      user: `${user.firstName} ${user.lastName}`,
      reportType,
      filename,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfSize: pdfBuffer.length,
      message: `PDF generated successfully. Save this as ${filename}`,
    });

  } catch (error: any) {
    console.error('[Manual PDF] Error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
