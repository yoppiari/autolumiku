/**
 * Test Sales Report PDF Generator
 * GET /api/v1/debug/test-sales-report-pdf
 *
 * Tests the WhatsAppCommandPDF generator for sales reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WhatsAppCommandPDF } from '@/lib/reports/whatsapp-command-pdf';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: false,
  };

  try {
    results.steps.push({ step: '1. Database Connection', status: 'running' });
    await prisma.$connect();
    results.steps[0].status = 'ok';

    // Get tenant
    results.steps.push({ step: '2. Get Tenant', status: 'running' });
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new Error('No tenant found in database');
    }
    results.steps[1].status = 'ok';
    results.steps[1].data = { tenantName: tenant.name };

    // Fetch sales data
    results.steps.push({ step: '3. Fetch Sales Data', status: 'running' });
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'SOLD',
        updatedAt: { gte: startDate },
      },
      select: {
        make: true,
        price: true,
        createdBy: true,
      },
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

    results.steps[2].status = 'ok';
    results.steps[2].data = {
      salesCount: totalSalesCount,
      salesValue: totalSalesValue,
      avgPrice,
      byMakeCount: Object.keys(byMake).length,
    };

    // Fetch staff data
    results.steps.push({ step: '4. Fetch Staff Data', status: 'running' });
    const salesStaff = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const staffSales: Record<string, { name: string; count: number; value: number }> = {};
    salesStaff.forEach((user) => {
      staffSales[user.id] = {
        name: `${user.firstName} ${user.lastName}`,
        count: 0,
        value: 0,
      };
    });

    soldVehicles.forEach((v) => {
      if (v.createdBy && staffSales[v.createdBy]) {
        staffSales[v.createdBy].count++;
        staffSales[v.createdBy].value += Number(v.price);
      }
    });

    const topPerformers = Object.entries(staffSales)
      .map(([id, data]) => ({ id, ...data }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    results.steps[3].status = 'ok';
    results.steps[3].data = { staffCount: topPerformers.length };

    // Generate PDF
    results.steps.push({ step: '5. Generate PDF', status: 'running' });
    const generator = new WhatsAppCommandPDF();

    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const metrics = [
      {
        label: 'Total Penjualan',
        value: `${totalSalesCount}`,
        unit: 'Unit',
        color: '#3b82f6',
        formula: 'COUNT(vehicle) WHERE status = SOLD',
        calculation: `${totalSalesCount} unit terjual`,
      },
      {
        label: 'Total Revenue',
        value: formatCurrency(totalSalesValue),
        color: '#10b981',
        formula: 'SUM(price) WHERE status = SOLD',
        calculation: formatCurrency(totalSalesValue),
      },
      {
        label: 'Rata-rata Harga',
        value: formatCurrency(avgPrice),
        color: '#f59e0b',
        formula: 'AVG(price) WHERE status = SOLD',
        calculation: `${formatCurrency(totalSalesValue)} / ${totalSalesCount} = ${formatCurrency(avgPrice)}`,
      },
      {
        label: 'Top Sales Staff',
        value: topPerformers.length > 0 ? topPerformers[0].name : 'N/A',
        unit: topPerformers.length > 0 ? `${topPerformers[0].count} unit` : '',
        color: '#8b5cf6',
        formula: 'MAX(COUNT(sales)) GROUP BY staff',
        calculation: topPerformers.length > 0
          ? `${topPerformers[0].name} menjual ${topPerformers[0].count} unit`
          : 'Belum ada data penjualan',
      },
    ];

    const reportData = {
      title: 'Sales Report Showroom',
      subtitle: 'Laporan Penjualan Lengkap',
      tenantName: tenant.name,
      date: new Date(),
      metrics,
      showChart: Object.keys(byMake).length > 0,
      chartData: Object.entries(byMake)
        .map(([make, data]) => ({ make, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item, idx) => ({
          label: item.make,
          value: item.count,
          color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
        })),
    };

    const pdfBuffer = await generator.generate(reportData);
    results.steps[4].status = 'ok';
    results.steps[4].data = {
      pdfSize: pdfBuffer.length,
      pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2) + ' KB',
    };

    results.success = true;
    results.message = 'Sales Report PDF test passed!';

    // Return the PDF for download
    const filename = `test-sales-report-${new Date().toISOString().split('T')[0]}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          steps: results.steps,
          message: 'Professional 2-page PDF with donut chart and formulas',
        }),
      },
    });

  } catch (error: any) {
    results.steps.push({
      step: 'ERROR',
      status: 'failed',
      error: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 30).join('\n'),
    });
    results.success = false;
    results.message = 'Sales Report PDF test failed: ' + error.message;

    console.error('[Sales Report PDF Test] Error:', error);

    return NextResponse.json(results, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}
