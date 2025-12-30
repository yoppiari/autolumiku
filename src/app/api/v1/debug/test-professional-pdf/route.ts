/**
 * Test Professional PDF Generator
 * GET /api/v1/debug/test-professional-pdf
 *
 * Tests the new AnalyticsPDFGenerator with professional charts and layout
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
    results.steps.push({ step: '2. Get Tenant Data', status: 'running' });
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });
    results.steps[1].status = 'ok';
    results.steps[1].data = { tenantId: tenant?.id, tenantName: tenant?.name };

    if (!tenant) {
      throw new Error('No tenant found in database');
    }

    // Gather test data (same as production code)
    results.steps.push({ step: '3. Gather Sales Data', status: 'running' });
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 30);

    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'SOLD',
        updatedAt: { gte: startDate },
      },
      select: {
        make: true,
        model: true,
        year: true,
        price: true,
        updatedAt: true,
        createdBy: true,
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

    // Get sales staff performance
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

    const staffSales: Record<string, { name: string; count: number; value: number; vehicles: any[] }> = {};
    salesStaff.forEach((user) => {
      staffSales[user.id] = {
        name: `${user.firstName} ${user.lastName}`,
        count: 0,
        value: 0,
        vehicles: [],
      };
    });

    soldVehicles.forEach((v) => {
      if (v.createdBy && staffSales[v.createdBy]) {
        staffSales[v.createdBy].count++;
        staffSales[v.createdBy].value += Number(v.price);
        staffSales[v.createdBy].vehicles.push(v);
      }
    });

    const topPerformers = Object.entries(staffSales)
      .map(([id, data]) => ({ id, ...data }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate KPIs
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

    const employees = salesStaff.length;
    const salesPerEmployee = employees > 0
      ? Math.min((totalSalesCount / (employees * 2)) * 100, 100)
      : 0;

    results.steps[2].status = 'ok';
    results.steps[2].data = {
      salesCount: totalSalesCount,
      salesValue: totalSalesValue,
      makes: Object.keys(byMake).length,
      topPerformers: topPerformers.length,
    };

    // Prepare data for PDF generator
    results.steps.push({ step: '4. Test AnalyticsPDFGenerator', status: 'running' });
    const generator = new AnalyticsPDFGenerator();

    const reportData = {
      tenantName: tenant.name,
      salesData: {
        summary: {
          totalSalesCount,
          totalSalesValue,
          totalVehicles,
          employees,
        },
        byMake: Object.entries(byMake).map(([make, data]) => ({ make, ...data })),
        topPerformers,
        kpis: {
          inventoryTurnover: Math.round(inventoryTurnover),
          atv: Math.round(atv),
          salesPerEmployee: Math.round(salesPerEmployee),
          avgPrice,
        },
      },
      whatsappData: null,
      startDate,
      endDate: now,
    };

    results.steps[3].data = {
      hasSalesData: true,
      salesData: reportData.salesData,
    };

    // Generate PDF
    const pdfBuffer = await generator.generate(reportData);

    results.steps[3].status = 'ok';
    results.steps[3].data = {
      pdfSize: pdfBuffer.length,
      pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2) + ' KB',
      generator: 'AnalyticsPDFGenerator',
      features: [
        'Colored metric cards',
        'Bar charts for sales by make',
        'KPI boxes with calculations',
        'Executive summary',
        'Insights with icons',
        'Professional layout',
      ],
    };

    results.success = true;
    results.message = '✅ Professional PDF generator test passed!';

    // Return the PDF for download
    const filename = `test-professional-analytics-${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          pdfSize: pdfBuffer.length,
          features: results.steps[3].data.features,
        }),
      },
    });

  } catch (error: any) {
    console.error('[Test Professional PDF] Error:', error);
    results.steps.push({
      step: 'ERROR',
      status: 'failed',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 15).join('\n'),
    });
    results.success = false;
    results.message = '❌ Professional PDF generator test failed: ' + error.message;

    return NextResponse.json(results, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}
