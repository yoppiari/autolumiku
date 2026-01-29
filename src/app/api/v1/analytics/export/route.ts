/**
 * POST /api/v1/analytics/export - Export Analytics Report
 *
 * Protected: Requires ADMIN+ role (roleLevel >= 90)
 * Exports analytics report to PDF or Excel format
 *
 * Query params:
 * - format: 'pdf' | 'excel' (default: 'pdf')
 * - department: 'sales' | 'finance' | 'whatsapp-ai' | 'all' (default: 'all')
 * - period: 'monthly' | 'quarterly' | 'yearly' (default: 'monthly')
 * - timeRange: '7d' | '30d' | '90d' | '1y' (default: '30d')
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { createPDFDocument } from '@/lib/services/whatsapp-ai/utils/pdf-init';
import { WhatsAppCommandPDF } from '@/lib/reports/whatsapp-command-pdf';

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
    let whatsappData = null;

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

      // Get employee count
      const employees = await prisma.user.count({
        where: {
          tenantId,
          role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
        },
      });

      const salesPerEmployee = employees > 0
        ? Math.min((totalSalesCount / (employees * 2)) * 100, 100)
        : 0;

      salesData = {
        summary: { totalSalesCount, totalSalesValue, totalVehicles, employees },
        vehicles: soldVehicles.map((v) => ({
          ...v,
          price: Number(v.price),
        })),
        byMake: Object.entries(byMake).map(([make, data]) => ({
          make,
          ...data,
        })),
        topPerformers,
        kpis: {
          inventoryTurnover: Math.round(inventoryTurnover),
          atv: Math.round(atv),
          salesPerEmployee: Math.round(salesPerEmployee),
          avgPrice,
        },
      };
    }


    if (department === 'whatsapp-ai' || department === 'all') {
      try {
        // Get WhatsApp conversations
        const conversations = await prisma.whatsAppConversation.findMany({
          where: {
            tenantId,
            startedAt: { gte: startDate },
            status: { not: 'deleted' },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 50,
            },
          },
          take: 500,
          orderBy: { startedAt: 'desc' },
        });

        // Calculate metrics
        const totalConversations = conversations.length;
        const activeConversations = conversations.filter((c) => c.status === 'active').length;

        // Count messages
        const customerMessages = conversations.reduce((sum, c) => {
          return sum + c.messages.filter((m) => m.direction === 'inbound').length;
        }, 0);

        const aiResponses = conversations.reduce((sum, c) => {
          return sum + c.messages.filter((m) => m.direction === 'outbound' && m.aiResponse).length;
        }, 0);

        const staffResponses = conversations.reduce((sum, c) => {
          return sum + c.messages.filter((m) => m.direction === 'outbound' && !m.aiResponse).length;
        }, 0);

        // AI Response Rate
        const aiResponseRate = customerMessages > 0
          ? Math.round((aiResponses / customerMessages) * 100)
          : 0;

        // Escalated conversations (has staff messages)
        const escalatedConversations = conversations.filter((c) =>
          c.messages.some((m) => m.direction === 'outbound' && !m.aiResponse)
        ).length;

        // Calculate average response time (simplified)
        const responseTimes: number[] = [];
        conversations.forEach((c) => {
          const messages = c.messages;
          for (let i = 0; i < messages.length - 1; i++) {
            const current = messages[i];
            const next = messages[i + 1];
            if (
              current.direction === 'inbound' &&
              next.direction === 'outbound' &&
              next.aiResponse
            ) {
              const rt = (new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()) / 1000;
              if (rt > 0 && rt < 300) responseTimes.push(rt);
            }
          }
        });
        const avgResponseTime = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 5;

        // AI Accuracy (non-escalated rate)
        const aiAccuracy = totalConversations > 0
          ? Math.round(((totalConversations - escalatedConversations) / totalConversations) * 100)
          : 0;

        // Intent breakdown (simplified - based on message content)
        const intents = {
          vehicle: 0,
          price: 0,
          greeting: 0,
          general: 0,
        };

        conversations.slice(0, 100).forEach((c) => {
          const firstMessage = c.messages.find((m) => m.direction === 'inbound');
          if (firstMessage) {
            const content = firstMessage.content.toLowerCase();
            if (content.includes('harga') || content.includes('price') || content.includes('berapa')) {
              intents.price++;
            } else if (content.includes('mobil') || content.includes('unit') || content.includes('stok')) {
              intents.vehicle++;
            } else if (content.includes('halo') || content.includes('hi') || content.includes('hello') || content.includes('selamat')) {
              intents.greeting++;
            } else {
              intents.general++;
            }
          }
        });

        const totalIntents = Object.values(intents).reduce((a, b) => a + b, 0);
        const intentBreakdown = Object.entries(intents).map(([intent, count]) => ({
          intent,
          count,
          percentage: totalIntents > 0 ? Math.round((count / totalIntents) * 100) : 0,
        }));

        whatsappData = {
          overview: {
            totalConversations,
            activeConversations,
            customerMessages,
            aiResponses,
            staffResponses,
            aiResponseRate,
            escalatedConversations,
            avgResponseTime,
            aiAccuracy,
          },
          intentBreakdown,
          topConversations: conversations.slice(0, 20).map((c) => ({
            phone: c.customerPhone,
            status: c.status,
            messageCount: c.messages.length,
            startedAt: c.startedAt,
            lastActivity: c.messages.length > 0
              ? c.messages[c.messages.length - 1].createdAt
              : c.startedAt,
          })),
        };
      } catch (error) {
        console.error('Error fetching WhatsApp AI data:', error);
        // Continue without WhatsApp data if table doesn't exist
        whatsappData = null;
      }
    }

    // Generate based on format
    if (format === 'pdf') {
      console.log('[Analytics Export] 🎨 Using WhatsAppCommandPDF (1-page professional)');
      // Use WhatsAppCommandPDF for consistent 1-page professional format
      const generator = new WhatsAppCommandPDF();

      // Convert complex data to simple metrics format
      const metrics = [
        {
          label: 'Total Penjualan',
          value: `${salesData?.summary?.totalSalesCount || 0}`,
          unit: 'Unit',
          color: '#3b82f6',
        },
        {
          label: 'Total Revenue',
          value: formatCurrency(salesData?.summary?.totalSalesValue || 0),
          color: '#10b981',
        },
        {
          label: 'Rata-rata Harga',
          value: formatCurrency(
            (salesData?.summary?.totalSalesCount || 0) > 0
              ? (salesData?.summary?.totalSalesValue || 0) / (salesData?.summary?.totalSalesCount || 1)
              : 0
          ),
          color: '#f59e0b',
        },
        {
          label: 'Conversations',
          value: `${whatsappData?.overview?.totalConversations || 0}`,
          unit: 'Chat',
          color: '#8b5cf6',
        },
        {
          label: 'Staff Active',
          value: `${salesData?.summary?.employees || 0}`,
          unit: 'Staff',
          color: '#ec4899',
        },
        {
          label: 'Total Inventory',
          value: `${salesData?.summary?.totalVehicles || 0}`,
          unit: 'Unit',
          color: '#6366f1',
        },
      ];

      // Create chart data from sales by make
      const chartData = (salesData?.byMake || [])
        .slice(0, 5)
        .map((item: any, idx: number) => ({
          label: item.make,
          value: `${item.count} unit`,
          color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
        }));

      const reportData = {
        title: 'Analytics Report',
        subtitle: `Export: ${formatDate(startDate)} - ${formatDate(now)}`,
        tenantName: tenant?.name || 'Prima Mobil',
        logoUrl: tenant?.logoUrl || undefined,
        date: now,
        metrics,
        showChart: chartData.length > 0,
        chartData,
      };

      console.log('[Analytics Export] 📊 Report data prepared:', {
        tenant: reportData.tenantName,
        metricsCount: metrics.length,
        chartDataCount: chartData.length,
      });

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generator.generate(reportData);
        console.log('[Analytics Export] ✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      } catch (pdfError) {
        console.error('[Analytics Export] ❌ PDF generation failed:', pdfError);
        return NextResponse.json(
          {
            error: 'Failed to generate PDF report',
            details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF generation error',
            stack: pdfError instanceof Error ? pdfError.stack : undefined,
          },
          { status: 500 }
        );
      }

      const filename = `analytics-sales-whatsapp-${new Date().toISOString().split('T')[0]}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } else {
      // Excel Generation with Sales + WhatsApp AI
      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData: any[] = [];

      if (salesData) {
        summaryData.push(['LAPORAN PENJUALAN'], ['']);
        summaryData.push(['Total Penjualan', salesData.summary.totalSalesCount, 'unit']);
        summaryData.push(['Total Nilai', formatCurrency(salesData.summary.totalSalesValue)]);
        summaryData.push(['Rata-rata per Unit', salesData.summary.totalSalesCount > 0
          ? formatCurrency(salesData.summary.totalSalesValue / salesData.summary.totalSalesCount)
          : 'Rp 0']);
        summaryData.push(['']);
      }

      if (whatsappData) {
        summaryData.push(['WHATSAPP AI ANALYTICS'], ['']);
        summaryData.push(['Total Percakapan', whatsappData.overview.totalConversations]);
        summaryData.push(['Percakapan Aktif', whatsappData.overview.activeConversations]);
        summaryData.push(['Pesan Pelanggan', whatsappData.overview.customerMessages]);
        summaryData.push(['AI Response Rate', `${whatsappData.overview.aiResponseRate}%`]);
        summaryData.push(['AI Accuracy', `${whatsappData.overview.aiAccuracy}%`]);
        summaryData.push(['Escalated Conversations', whatsappData.overview.escalatedConversations]);
        summaryData.push(['Avg Response Time', `${whatsappData.overview.avgResponseTime} detik`]);
        summaryData.push(['']);
      }

      summaryData.push(['Periode', `${formatDate(startDate)} - ${formatDate(now)}`]);
      summaryData.push(['Dibuat pada', formatDate(now)]);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Sales Detail Sheet
      if (salesData) {
        const salesDataForExcel: any[] = [
          ['No', 'Merek', 'Model', 'Tahun', 'Harga', 'Tanggal'],
          ...salesData.vehicles.map((v, idx) => [
            idx + 1,
            v.make,
            v.model,
            v.year,
            v.price,
            new Date(v.updatedAt).toLocaleDateString('id-ID'),
          ]),
        ];

        const salesSheet = XLSX.utils.aoa_to_sheet(salesDataForExcel);
        XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales Detail');
      }

      // Sales by Make Sheet
      if (salesData) {
        const byMakeData: any[] = [
          ['Merek', 'Jumlah Unit', 'Total Nilai'],
          ...salesData.byMake.map((item) => [
            item.make,
            item.count,
            item.value,
          ]),
        ];

        const byMakeSheet = XLSX.utils.aoa_to_sheet(byMakeData);
        XLSX.utils.book_append_sheet(workbook, byMakeSheet, 'Sales by Make');
      }

      // Top Performers Sheet
      if (salesData && salesData.topPerformers.length > 0) {
        const performersData: any[] = [
          ['Peringkat', 'Nama Sales', 'Unit Terjual', 'Total Nilai', 'Rata-rata Harga'],
          ...salesData.topPerformers.map((p, idx) => [
            idx + 1,
            p.name,
            p.count,
            p.value,
            p.count > 0 ? p.value / p.count : 0,
          ]),
        ];

        const performersSheet = XLSX.utils.aoa_to_sheet(performersData);
        XLSX.utils.book_append_sheet(workbook, performersSheet, 'Top Performers');
      }

      // KPIs Sheet
      if (salesData && salesData.kpis) {
        const kpisData: any[] = [
          ['KPI', 'Nilai', 'Status', 'Penjelasan'],
          [
            'Inventory Turnover',
            `${salesData.kpis.inventoryTurnover}%`,
            salesData.kpis.inventoryTurnover >= 20 ? 'BAIK' : salesData.kpis.inventoryTurnover >= 10 ? 'CUKUP' : 'PERLU IMPROVEMENT',
            salesData.kpis.inventoryTurnover >= 20 ? 'Inventory berputar dengan baik' : salesData.kpis.inventoryTurnover >= 10 ? 'Cukup baik - perlu monitor' : 'Perlu improvement - stok terlalu banyak',
          ],
          [
            'Average Transaction Value',
            `${salesData.kpis.atv}%`,
            salesData.kpis.atv >= 80 ? 'BAIK' : salesData.kpis.atv >= 60 ? 'CUKUP' : 'DI BAWAH RATA-RATA',
            salesData.kpis.avgPrice >= 150000000 ? 'Di atas rata-rata industri' : salesData.kpis.avgPrice >= 100000000 ? 'Sekitar rata-rata' : 'Di bawah rata-rata',
          ],
          [
            'Sales per Employee',
            `${salesData.kpis.salesPerEmployee}%`,
            salesData.kpis.salesPerEmployee >= 80 ? 'EXCELLENT' : salesData.kpis.salesPerEmployee >= 60 ? 'BAIK' : 'PERLU IMPROVEMENT',
            salesData.kpis.salesPerEmployee >= 80 ? 'Productivitas sangat baik' : salesData.kpis.salesPerEmployee >= 60 ? 'Productivitas baik' : 'Perlu training dan motivasi',
          ],
          [],
          ['TOTAL STOK', salesData.summary.totalVehicles, '', ''],
          ['JUMLAH SALES', salesData.summary.employees, '', ''],
        ];

        const kpisSheet = XLSX.utils.aoa_to_sheet(kpisData);
        XLSX.utils.book_append_sheet(workbook, kpisSheet, 'KPIs');
      }

      // WhatsApp AI Detail Sheet
      if (whatsappData) {
        // Intent Breakdown
        const intentData: any[] = [
          ['Intent', 'Jumlah', 'Persentase'],
          ...whatsappData.intentBreakdown.map((item) => [
            item.intent.charAt(0).toUpperCase() + item.intent.slice(1),
            item.count,
            `${item.percentage}%`,
          ]),
        ];

        const intentSheet = XLSX.utils.aoa_to_sheet(intentData);
        XLSX.utils.book_append_sheet(workbook, intentSheet, 'WA Intent Breakdown');

        // Conversations
        const conversationsData: any[] = [
          ['No', 'No. HP', 'Status', 'Jumlah Pesan', 'Mulai', 'Aktivitas Terakhir'],
          ...whatsappData.topConversations.map((c, idx) => [
            idx + 1,
            c.phone,
            c.status,
            c.messageCount,
            new Date(c.startedAt).toLocaleString('id-ID'),
            new Date(c.lastActivity).toLocaleString('id-ID'),
          ]),
        ];

        const conversationsSheet = XLSX.utils.aoa_to_sheet(conversationsData);
        XLSX.utils.book_append_sheet(workbook, conversationsSheet, 'WA Conversations');
      }

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const filename = `analytics-sales-whatsapp-${new Date().toISOString().split('T')[0]}.xlsx`;

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': excelBuffer.length.toString(),
        },
      });
    }
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
