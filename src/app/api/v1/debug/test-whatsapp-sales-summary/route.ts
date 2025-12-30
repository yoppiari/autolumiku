/**
 * Test WhatsApp AI Sales Summary PDF
 * GET /api/v1/debug/test-whatsapp-sales-summary
 *
 * Tests the generateSalesSummaryPDF function used by WhatsApp AI commands
 * This simulates what happens when a user sends "sales summary" via WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CompactExecutivePDF } from '@/lib/reports/compact-executive-pdf';

// Import the function from command-handler
async function generateSalesSummaryPDF(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  // Fetch sales data
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

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
      tenantId,
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
      tenantId,
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

  // Calculate date range
  const endDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  // Use COMPACT 2-page Executive PDF Generator
  const generator = new CompactExecutivePDF();

  const reportData = {
    tenantName: tenant?.name || 'Prima Mobil',
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

  console.log('[WhatsApp Sales Summary Test] 📊 Using COMPACT 2-page generator:', {
    tenant: reportData.tenantName,
    hasSalesData: !!reportData.salesData,
    salesCount: reportData.salesData?.summary?.totalSalesCount || 0,
    generator: 'CompactExecutivePDF (2 pages)',
  });

  const pdfBuffer = await generator.generate(reportData);

  console.log('[WhatsApp Sales Summary Test] ✅ Compact 2-page PDF generated, size:', pdfBuffer.length, 'bytes');

  return pdfBuffer;
}

export async function GET(request: NextRequest) {
  try {
    console.log('[WhatsApp Sales Summary Test] Starting test...');

    await prisma.$connect();

    // Get first tenant
    const tenant = await prisma.tenant.findFirst({
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'No tenant found in database',
      }, { status: 404 });
    }

    console.log('[WhatsApp Sales Summary Test] Tenant:', tenant.name);

    // Generate PDF using the same function as WhatsApp AI
    const pdfBuffer = await generateSalesSummaryPDF(tenant.id);

    const filename = `whatsapp-sales-summary-${new Date().toISOString().split('T')[0]}.pdf`;

    console.log('[WhatsApp Sales Summary Test] ✅ Test completed successfully');

    // Return the PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Test-Results': JSON.stringify({
          success: true,
          tenantName: tenant.name,
          pdfSize: pdfBuffer.length,
          pdfSizeKB: (pdfBuffer.length / 1024).toFixed(2) + ' KB',
          generator: 'CompactExecutivePDF (2-Page)',
          pages: 2,
          message: 'This PDF uses the same CompactExecutivePDF that WhatsApp AI "sales summary" command uses',
        }),
      },
    });

  } catch (error: any) {
    console.error('[WhatsApp Sales Summary Test] ❌ Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 15).join('\n'),
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
}
