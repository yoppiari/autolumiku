/**
 * Test Analytics Export Endpoint
 * GET /api/v1/debug/test-analytics-export
 *
 * Debug endpoint to test analytics export without authentication
 * Shows detailed error information
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AnalyticsPDFGenerator } from '@/lib/reports/analytics-pdf-generator';

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

    // Test tenant query
    results.steps.push({ step: '2. Test Tenant Query', status: 'running' });
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });
    results.steps[1].status = 'ok';
    results.steps[1].data = { tenantId: tenant?.id, tenantName: tenant?.name };

    if (!tenant) {
      throw new Error('No tenant found in database');
    }

    // Prepare report data
    results.steps.push({ step: '3. Prepare Report Data', status: 'running' });
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
        model: true,
        price: true,
        createdBy: true,
      },
    });

    const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const totalSalesCount = soldVehicles.length;

    const byMake: Record<string, { count: number; value: number }> = {};
    soldVehicles.forEach((v) => {
      const make = v.make || 'Other';
      if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
      byMake[make].count++;
      byMake[make].value += Number(v.price);
    });

    const totalVehicles = await prisma.vehicle.count({
      where: {
        tenantId: tenant.id,
        status: { in: ['AVAILABLE', 'BOOKED'] },
      },
    });

    const inventoryTurnover = totalSalesCount / (totalSalesCount + totalVehicles) * 100;
    const avgPrice = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;
    const industryAvgPrice = 150000000;
    const atv = Math.min((avgPrice / industryAvgPrice) * 100, 100);

    const salesStaff = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    const employees = salesStaff.length;
    const salesPerEmployee = employees > 0
      ? Math.min((totalSalesCount / (employees * 2)) * 100, 100)
      : 0;

    const salesData = {
      summary: { totalSalesCount, totalSalesValue, totalVehicles, employees },
      vehicles: soldVehicles.map((v) => ({ ...v, price: Number(v.price) })),
      byMake: Object.entries(byMake).map(([make, data]) => ({ make, ...data })),
      topPerformers: [],
      kpis: {
        inventoryTurnover: Math.round(inventoryTurnover),
        atv: Math.round(atv),
        salesPerEmployee: Math.round(salesPerEmployee),
        avgPrice,
      },
    };

    results.steps[2].status = 'ok';
    results.steps[2].data = {
      salesCount: totalSalesCount,
      salesValue: totalSalesValue,
      totalVehicles,
    };

    // Test AnalyticsPDFGenerator
    results.steps.push({ step: '4. Test AnalyticsPDFGenerator', status: 'running' });
    const generator = new AnalyticsPDFGenerator();
    results.steps[3].status = 'ok';
    results.steps[3].data = { message: 'Generator created successfully' };

    // Generate PDF
    results.steps.push({ step: '5. Generate PDF', status: 'running' });
    const reportData = {
      tenantName: tenant.name,
      salesData,
      whatsappData: null,
      startDate,
      endDate,
    };

    const pdfBuffer = await generator.generate(reportData);
    results.steps[4].status = 'ok';
    results.steps[4].data = {
      pdfSize: pdfBuffer.length,
      pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2) + ' KB',
    };

    results.success = true;
    results.message = 'Analytics PDF generation successful!';
    results.pdfSize = pdfBuffer.length;

    // Return the PDF for download
    const filename = `analytics-test-${new Date().toISOString().split('T')[0]}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          steps: results.steps,
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
    results.message = 'Analytics export test failed: ' + error.message;

    console.error('[Analytics Export Test] Error:', error);
    console.error('[Analytics Export Test] Stack:', error.stack);

    return NextResponse.json(results, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}
