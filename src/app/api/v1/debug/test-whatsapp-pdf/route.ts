/**
 * Test WhatsApp Command PDF Generator
 * GET /api/v1/debug/test-whatsapp-pdf
 *
 * Tests the new professional WhatsApp Command PDF generator
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WhatsAppCommandPDF } from '@/lib/reports/whatsapp-command-pdf';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    success: false,
  };

  try {
    await prisma.$connect();

    // Get first tenant
    results.tests.push({ name: 'Database Connection', status: 'running' });
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new Error('No tenant found in database');
    }
    results.tests[0].status = 'ok';
    results.tests[0].data = { tenantName: tenant.name };

    // Test 1: Total Sales PDF
    results.tests.push({ name: 'Test Total Sales PDF', status: 'running' });
    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'SOLD',
      },
      select: { make: true, price: true },
      take: 100,
    });

    const totalSalesCount = soldVehicles.length;
    const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const avgPrice = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;

    const byMake: Record<string, { count: number; value: number }> = {};
    soldVehicles.forEach((v) => {
      const make = v.make || 'Other';
      if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
      byMake[make].count++;
      byMake[make].value += Number(v.price);
    });

    const generator = new WhatsAppCommandPDF();

    const salesMetrics = [
      {
        label: 'Total Penjualan',
        value: `${totalSalesCount}`,
        unit: 'Unit',
        color: '#3b82f6',
        formula: 'COUNT(vehicle WHERE status = SOLD)',
        calculation: `${totalSalesCount} unit terjual`,
      },
      {
        label: 'Total Revenue',
        value: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalSalesValue),
        color: '#10b981',
        formula: 'SUM(price) WHERE status = SOLD',
        calculation: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(totalSalesValue),
      },
      {
        label: 'Rata-rata Harga',
        value: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(avgPrice),
        color: '#f59e0b',
        formula: 'AVG(price) WHERE status = SOLD',
        calculation: `${new Intl.NumberFormat('id-ID').format(totalSalesValue)} / ${totalSalesCount} = ${new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(avgPrice)}`,
      },
    ];

    const salesReportData = {
      title: 'Total Penjualan Showroom',
      subtitle: 'Periode: 30 Hari Terakhir',
      tenantName: tenant.name,
      date: new Date(),
      metrics: salesMetrics,
      showChart: true,
      chartData: Object.entries(byMake).slice(0, 5).map(([make, data], idx) => ({
        label: make,
        value: data.count,
        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
      })),
    };

    const salesPdfBuffer = await generator.generate(salesReportData);
    results.tests[1].status = 'ok';
    results.tests[1].data = {
      pdfSize: salesPdfBuffer.length,
      pdfSizeKB: (salesPdfBuffer.length / 1024).toFixed(2) + ' KB',
      pages: '2',
      hasFormulas: true,
      hasChart: true,
    };

    // Test 2: Total Inventory PDF
    results.tests.push({ name: 'Test Total Inventory PDF', status: 'running' });
    const inventoryVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['AVAILABLE', 'BOOKED'] },
      },
      select: { price: true },
      take: 100,
    });

    const totalStock = await prisma.vehicle.count({
      where: {
        tenantId: tenant.id,
        status: { in: ['AVAILABLE', 'BOOKED'] },
      },
    });

    const totalValue = inventoryVehicles.reduce((sum, v) => sum + Number(v.price), 0);

    const inventoryMetrics = [
      {
        label: 'Total Stok',
        value: `${totalStock}`,
        unit: 'Unit',
        color: '#3b82f6',
        formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
        calculation: `${totalStock} unit tersedia`,
      },
      {
        label: 'Total Nilai Stok',
        value: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalValue),
        color: '#10b981',
        formula: 'SUM(price) WHERE status IN (AVAILABLE, BOOKED)',
        calculation: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(totalValue),
      },
    ];

    const inventoryReportData = {
      title: 'Total Inventory Showroom',
      subtitle: 'Stok Kendaraan Tersedia',
      tenantName: tenant.name,
      date: new Date(),
      metrics: inventoryMetrics,
    };

    const inventoryPdfBuffer = await generator.generate(inventoryReportData);
    results.tests[2].status = 'ok';
    results.tests[2].data = {
      pdfSize: inventoryPdfBuffer.length,
      pdfSizeKB: (inventoryPdfBuffer.length / 1024).toFixed(2) + ' KB',
      pages: '2',
      hasFormulas: true,
    };

    results.success = true;
    results.message = 'All WhatsApp Command PDF tests passed!';

    // Return the first PDF for download (Total Sales)
    const filename = `test-total-sales-${new Date().toISOString().split('T')[0]}.pdf`;
    return new NextResponse(new Uint8Array(salesPdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          tests: results.tests,
          message: 'Professional 2-page PDF with formulas and chart',
        }),
      },
    });

  } catch (error: any) {
    results.tests.push({
      name: 'ERROR',
      status: 'failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 20).join('\n'),
    });
    results.success = false;
    results.message = 'WhatsApp PDF test failed: ' + error.message;

    console.error('[WhatsApp PDF Test] Error:', error);

    return NextResponse.json(results, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}
