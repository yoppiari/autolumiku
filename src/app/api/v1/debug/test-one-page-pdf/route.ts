/**
 * Test One-Page Sales PDF Generator
 * GET /api/v1/debug/test-one-page-pdf?tenantName=Prima+Mobil
 */

import { NextRequest, NextResponse } from 'next/server';
import { OnePageSalesPDF } from '@/lib/reports/one-page-sales-pdf';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantName = searchParams.get('tenantName') || 'Prima Mobil';

    console.log('[TestOnePagePDF] Generating PDF for tenant:', tenantName);

    const generator = new OnePageSalesPDF();
    const pdfBuffer = await generator.generate({
      tenantName,
      period: new Date().toISOString().split('T')[0],
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sales-report-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[TestOnePagePDF] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

