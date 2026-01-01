/**
 * Test Compact 2-Page Executive PDF
 * GET /api/v1/debug/test-compact-pdf
 *
 * Tests the new 2-page compact executive summary PDF generator
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CompactExecutivePDF } from '@/lib/reports/compact-executive-pdf';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Compact PDF Test] Starting 2-page executive summary test...');

    await prisma.$connect();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'No tenant found',
      }, { status: 404 });
    }

    console.log('[Compact PDF Test] Tenant:', tenant.name);

    // Calculate date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    // Fetch sales data
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
    });

    const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
    const totalSalesCount = soldVehicles.length;

    // By make
    const byMake: Record<string, { count: number; value: number }> = {};
    soldVehicles.forEach((v) => {
      const make = v.make || 'Other';
      if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
      byMake[make].count++;
      byMake[make].value += Number(v.price);
    });

    // Staff performance
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
      .sort((a, b) => b.count - a.count);

    // KPIs
    const totalVehicles = await prisma.vehicle.count({
      where: {
        tenantId: tenant.id,
        status: { in: ['AVAILABLE', 'BOOKED'] },
      },
    });

    const inventoryTurnover = totalSalesCount / (totalSalesCount + totalVehicles) * 100;
    const avgPrice = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;
    const atv = Math.min((avgPrice / 150000000) * 100, 100);
    const employees = salesStaff.length;
    const salesPerEmployee = employees > 0
      ? Math.min((totalSalesCount / (employees * 2)) * 100, 100)
      : 0;

    // Generate compact PDF
    const generator = new CompactExecutivePDF();

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
      startDate,
      endDate,
    };

    console.log('[Compact PDF Test] Report data prepared');

    const pdfBuffer = await generator.generate(reportData);

    const filename = `executive-summary-${new Date().toISOString().split('T')[0]}.pdf`;

    console.log('[Compact PDF Test] ✅ 2-page PDF generated:', pdfBuffer.length, 'bytes');

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          tenantName: tenant.name,
          pages: 2,
          pdfSize: pdfBuffer.length,
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2) + ' KB',
          generator: 'CompactExecutivePDF (2-Page)',
          features: [
            '2 pages only',
            'Executive dashboard layout',
            'Compact metric cards',
            'Bar charts',
            'KPIs with formulas',
            'Insights & recommendations',
            'No wasted space',
          ],
        }),
      },
    });

  } catch (error: any) {
    console.error('[Compact PDF Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 15).join('\n'),
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore
    }
  }
}
