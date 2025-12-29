/**
 * Professional Analytics PDF Generator
 * Creates visually rich, professional PDF reports for showroom analytics
 * with charts, detailed calculations, and executive summary
 */

import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';

interface SalesData {
  summary: {
    totalSalesCount: number;
    totalSalesValue: number;
    totalVehicles: number;
    employees: number;
  };
  byMake: Array<{ make: string; count: number; value: number }>;
  topPerformers: Array<{ id: string; name: string; count: number; value: number }>;
  kpis: {
    inventoryTurnover: number;
    atv: number;
    salesPerEmployee: number;
    avgPrice: number;
  };
}

interface WhatsAppData {
  overview: {
    totalConversations: number;
    activeConversations: number;
    escalatedConversations: number;
    aiResponseRate: number;
    avgResponseTime: number;
    aiAccuracy: number;
  };
  intentBreakdown: Array<{ intent: string; count: number; percentage: number }>;
  topConversations: Array<any>;
}

interface ReportData {
  tenantName: string;
  salesData: SalesData | null;
  whatsappData: WhatsAppData | null;
  startDate: Date;
  endDate: Date;
}

export class AnalyticsPDFGenerator {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];
  private yPos: number = 0;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(data: ReportData): Promise<Buffer> {
    console.log('[AnalyticsPDFGenerator] 🚀 Starting professional PDF generation');
    console.log('[AnalyticsPDFGenerator] 📊 Tenant:', data.tenantName);
    console.log('[AnalyticsPDFGenerator] 📅 Period:', data.startDate, 'to', data.endDate);
    console.log('[AnalyticsPDFGenerator] 🚗 Sales data:', data.salesData ? 'YES' : 'NO');
    console.log('[AnalyticsPDFGenerator] 💬 WhatsApp data:', data.whatsappData ? 'YES' : 'NO');

    this.doc.addPage();

    // Cover Page with Executive Summary
    console.log('[AnalyticsPDFGenerator] 📄 Generating cover page...');
    this.generateCoverPage(data);

    // Table of Contents
    this.doc.addPage();
    console.log('[AnalyticsPDFGenerator] 📑 Generating table of contents...');
    this.generateTableOfContents(data);

    // Executive Summary - ALWAYS SHOW even if no data (show zeros)
    this.doc.addPage();
    this.generateExecutiveSummary(data);

    // Sales Analysis Section - ALWAYS SHOW even if no data (show empty chart)
    this.doc.addPage();
    this.generateSalesAnalysis(data);

    // Performance Metrics Section - ALWAYS SHOW even if no data (show 0 KPIs)
    this.doc.addPage();
    this.generatePerformanceMetrics(data);

    // WhatsApp AI Analytics - ALWAYS SHOW even if no data (show 0 metrics)
    this.doc.addPage();
    this.generateWhatsAppAnalytics(data);

    // Recommendations & Action Items - ALWAYS SHOW
    this.doc.addPage();
    this.generateRecommendations(data);

    // Footer
    this.doc.addPage();
    this.generateFooter(data);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[AnalyticsPDFGenerator] ✅ PDF generation completed!');
    console.log('[AnalyticsPDFGenerator] 📦 PDF size:', pdfBuffer.length, 'bytes');
    console.log('[AnalyticsPDFGenerator] 📄 Total pages generated');

    return pdfBuffer;
  }

  private generateCoverPage(data: ReportData) {
    const { doc } = this;

    // Background header
    doc.fillColor('#1e40af').rect(0, 0, doc.page.width, 150).fill();

    // Title
    doc.fillColor('#ffffff')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('LAPORAN ANALITIK', doc.page.width / 2, 60, { align: 'center' });

    doc.fontSize(18)
      .font('Helvetica')
      .text(data.tenantName || 'Showroom', doc.page.width / 2, 90, { align: 'center' });

    doc.fontSize(12)
      .text(`Periode: ${this.formatDate(data.startDate)} - ${this.formatDate(data.endDate)}`, doc.page.width / 2, 110, { align: 'center' });

    doc.fontSize(10)
      .fillColor('#93c5fd')
      .text(`Dibuat: ${this.formatDate(new Date())}`, doc.page.width / 2, 125, { align: 'center' });

    // Key Metrics Cards - ALWAYS SHOW (use 0 values if no data)
    const startY = 180;
    const cardWidth = (doc.page.width - 80) / 2;
    const cardHeight = 70;
    const gap = 15;

    // Get data or use defaults (0)
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const salesValue = data.salesData?.summary?.totalSalesValue || 0;
    const totalVehicles = data.salesData?.summary?.totalVehicles || 0;
    const employees = data.salesData?.summary?.employees || 0;

    // Sales Card
    this.drawMetricCard(
      40,
      startY,
      cardWidth,
      cardHeight,
      '#dbeafe',
      '#1e40af',
      'TOTAL PENJUALAN',
      `${salesCount} UNIT`,
      'Rp ' + this.formatNumber(salesValue)
    );

    // Revenue Card
    this.drawMetricCard(
      40 + cardWidth + gap,
      startY,
      cardWidth,
      cardHeight,
      '#dcfce7',
      '#15803d',
      'TOTAL REVENUE',
      'Rp ' + this.formatNumber(salesValue),
      'Omzet Keseluruhan'
    );

    // Conversion Rate Card
    const conversionRate = totalVehicles > 0
      ? Math.round((salesCount / (salesCount + totalVehicles)) * 100)
      : 0;

    this.drawMetricCard(
      40,
      startY + cardHeight + gap,
      cardWidth,
      cardHeight,
      '#fef3c7',
      '#b45309',
      'CONVERSION RATE',
      `${conversionRate}%`,
      'Penjualan : Stok'
    );

    // Employee Productivity Card
    const salesPerEmployee = data.salesData?.kpis?.salesPerEmployee || 0;

    this.drawMetricCard(
      40 + cardWidth + gap,
      startY + cardHeight + gap,
      cardWidth,
      cardHeight,
      '#f3e8ff',
      '#7c3aed',
      'PRODUKTIVITAS',
      `${salesPerEmployee}%`,
      'Penjualan per Karyawan'
    );

    this.yPos = startY + cardHeight * 2 + gap * 2 + 20;
  }

  private drawMetricCard(
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: string,
    textColor: string,
    title: string,
    value: string,
    subtitle: string
  ) {
    const { doc } = this;

    doc.fillColor(bgColor).rect(x, y, width, height).fill();
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(title, x + 15, y + 20);
    doc.fontSize(16).text(value, x + 15, y + 38);
    doc.fontSize(8).fillColor('#64748b').text(subtitle, x + 15, y + 55);
  }

  private generateTableOfContents(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('DAFTAR ISI', 80, 80);

    const contents = [
      { title: 'Executive Summary', page: 3 },
      { title: 'Sales Analysis', page: 4 },
      { title: 'Performance Metrics', page: 5 },
      ...(data.whatsappData ? [{ title: 'WhatsApp AI Analytics', page: 6 }] : []),
      { title: 'Recommendations & Action Items', page: data.whatsappData ? 7 : 6 },
    ];

    let y = 120;
    contents.forEach((item, idx) => {
      doc.fillColor('#475569')
        .fontSize(12)
        .font('Helvetica')
        .text(`${idx + 1}. ${item.title}`, 80, y);
      doc.fillColor('#94a3b8').text(`Halaman ${item.page}`, 450, y, { width: 100 });
      y += 25;
    });
  }

  private generateExecutiveSummary(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('EXECUTIVE SUMMARY', 80, 80);

    doc.moveDown(2);

    // Business Overview - ALWAYS SHOW (use 0 if no data)
    doc.fillColor('#334155')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BUSINESS OVERVIEW', 80, doc.y, { underline: true });

    doc.moveDown(1);

    // Get data or use defaults (0)
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const salesValue = data.salesData?.summary?.totalSalesValue || 0;
    const avgPrice = data.salesData?.kpis?.avgPrice || 0;
    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const topPerformer = data.salesData?.topPerformers?.[0]?.name || '-';

    const summary = [
      `Total penjualan periode ini: ${salesCount} unit dengan nilai Rp ${this.formatNumber(salesValue)}`,
      `Rata-rata harga per unit: Rp ${this.formatNumber(avgPrice)}`,
      `Conversion rate stok: ${inventoryTurnover}%`,
      salesCount > 0 ? `Top performer: ${topPerformer}` : 'Belum ada data penjualan',
    ];

    summary.forEach((line) => {
      doc.fontSize(10)
        .fillColor('#475569')
        .font('Helvetica')
        .text(`• ${line}`, 80, doc.y, { width: 450 });
      doc.moveDown(0.5);
    });

    doc.moveDown(2);

    // Key Insights - ALWAYS SHOW
    doc.fontSize(12)
      .fillColor('#334155')
      .font('Helvetica-Bold')
      .text('KEY INSIGHTS', 80, doc.y, { underline: true });

    doc.moveDown(1);

    const insights = this.generateInsights(data);
    insights.forEach((insight, idx) => {
      this.drawInsightBox(80, doc.y, 470, 40, insight.color, insight.icon, insight.title, insight.text);
      doc.moveDown(0.5);
    });
  }

  private generateInsights(data: ReportData) {
    const insights: Array<{
      color: string;
      icon: string;
      title: string;
      text: string;
    }> = [];

    // Sales Performance Insights - ALWAYS SHOW
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const salesValue = data.salesData?.summary?.totalSalesValue || 0;
    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const atv = data.salesData?.kpis?.atv || 0;

    if (salesCount === 0) {
      insights.push({
        color: '#fef3c7',
        icon: '⚠️',
        title: 'BELUM ADA PENJUALAN',
        text: 'Periode ini belum ada penjualan tercatat. Perlu review strategi marketing dan promosi.',
      });
    } else if (salesCount < 5) {
      insights.push({
        color: '#fee2e2',
        icon: '📉',
        title: 'PENJUALAN RENDAH',
        text: `Hanya ${salesCount} unit terjual. Pertimbangkan increase promosi dan aktivitas sales.`,
      });
    } else {
      insights.push({
        color: '#dcfce7',
        icon: '✅',
        title: 'PENJUALAN BAIK',
        text: `${salesCount} unit terjual dengan nilai Rp ${this.formatNumber(salesValue)}. Performa positif!`,
      });
    }

    // Inventory Insight - ALWAYS SHOW
    if (inventoryTurnover < 20) {
      insights.push({
        color: '#fef3c7',
        icon: '📦',
        title: 'STOK TINGGI',
        text: `Inventory turnover ${inventoryTurnover}%. Stok belum berputar optimal. Perlu evaluasi merek yang kurang laku.`,
      });
    } else {
      insights.push({
        color: '#dcfce7',
        icon: '🔄',
        title: 'STOK OPTIMAL',
        text: `Inventory turnover ${inventoryTurnover}%. Stok berputar dengan baik.`,
      });
    }

    // ATV Insight - ALWAYS SHOW
    if (atv >= 80) {
      insights.push({
        color: '#dcfce7',
        icon: '💰',
        title: 'HARGA KOMPETITIF',
        text: `ATV ${atv}% dari rata-rata industri. Harga jual di atas rata-rata.`,
      });
    } else if (atv >= 60) {
      insights.push({
        color: '#fef9c3',
        icon: '📊',
        title: 'HARGA WAJAR',
        text: `ATV ${atv}% dari rata-rata industri. Harga masuk kategori wajar.`,
      });
    } else {
      insights.push({
        color: '#fee2e2',
        icon: '⚠️',
        title: 'HARGA PERLU DITINGKATKAN',
        text: `ATV ${atv}% dari rata-rata industri. Pertimbangkan strategi pricing yang lebih agresif.`,
      });
    }

    // WhatsApp AI Insight - ALWAYS SHOW
    const aiAccuracy = data.whatsappData?.overview?.aiAccuracy || 0;
    if (aiAccuracy >= 80) {
      insights.push({
        color: '#dcfce7',
        icon: '🤖',
        title: 'AI SANGAT BAIK',
        text: `AI accuracy ${aiAccuracy}%. Respon AI sangat membantu reduce beban staff.`,
      });
    } else if (aiAccuracy >= 60) {
      insights.push({
        color: '#fef9c3',
        icon: '🤖',
        title: 'AI CUKUP BAIK',
        text: `AI accuracy ${aiAccuracy}%. Masih ada room untuk improvement.`,
      });
    } else if (aiAccuracy > 0) {
      insights.push({
        color: '#fee2e2',
        icon: '🤖',
        title: 'AI PERLU IMPROVEMENT',
        text: `AI accuracy hanya ${aiAccuracy}%. Perlu review dan improve respon AI.`,
      });
    } else {
      insights.push({
        color: '#f3f4f6',
        icon: '🤖',
        title: 'BELUM ADA DATA AI',
        text: 'Belum ada data percakapan WhatsApp AI untuk periode ini.',
      });
    }

    return insights;
  }

  private drawInsightBox(
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: string,
    icon: string,
    title: string,
    text: string
  ) {
    const { doc } = this;

    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    doc.fontSize(16).text(icon, x + 10, y + 12);
    doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold').text(title, x + 35, y + 14);

    doc.fontSize(9)
      .fillColor('#475569')
      .font('Helvetica')
      .text(text, x + 10, y + 32, { width: width - 20 });
  }

  private generateSalesAnalysis(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('SALES ANALYSIS', 80, 80);

    doc.moveDown(2);

    // Sales by Make - ALWAYS SHOW (use empty array if no data)
    doc.fontSize(14)
      .fillColor('#334155')
      .font('Helvetica-Bold')
      .text('Penjualan per Merek', 80, doc.y, { underline: true });

    doc.moveDown(1);

    const byMake = data.salesData?.byMake || [];

    // Table Header - ALWAYS SHOW
    const tableTop = doc.y;
    const colWidths = [200, 80, 100, 80];

    doc.fillColor('#f1f5f9').rect(80, tableTop, 460, 20).fill();

    doc.fillColor('#1e293b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Merek', 85, tableTop + 13);
    doc.text('Qty', 285, tableTop + 13);
    doc.text('Nilai', 365, tableTop + 13);
    doc.text('%', 445, tableTop + 13);

    // Table Rows
    let y = tableTop + 20;
    const totalValue = byMake.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

    if (byMake.length === 0) {
      // Show "No data" message row
      doc.fillColor('#ffffff').rect(80, y, 460, 25).fill();
      doc.fillColor('#94a3b8')
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text('Tidak ada penjualan untuk periode ini', 85, y + 15);
      y += 25;
    } else {
      byMake.forEach((item: any, idx: number) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.fillColor(bgColor).rect(80, y, 460, 25).fill();

        const percentage = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;

        doc.fillColor('#475569')
          .fontSize(9)
          .font('Helvetica')
          .text(item.make, 85, y + 15);
        doc.text(`${item.count} unit`, 285, y + 15);
        doc.text(`Rp ${this.formatNumber(item.value)}`, 365, y + 15);
        doc.text(`${percentage}%`, 470, y + 15);

        y += 25;
      });

      // Simple Bar Chart for Sales by Make
      y += 10;
      this.drawBarChart(byMake, 80, y, 460, 100);
    }

    doc.moveDown(2);
    this.yPos = doc.y;
  }

  private drawBarChart(
    data: Array<{ make: string; count: number; value: number }>,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const { doc } = this;

    doc.fontSize(12)
      .fillColor('#334155')
      .font('Helvetica-Bold')
      .text('Grafik Penjualan per Merek', x, y);

    const chartY = y + 20;
    const chartHeight = height - 30;
    const barWidth = (width - 40) / data.length - 10;
    const maxValue = Math.max(...data.map((d) => d.count));

    data.forEach((item, idx) => {
      const barHeight = maxValue > 0 ? (item.count / maxValue) * (chartHeight - 20) : 0;
      const barX = x + 20 + idx * (barWidth + 10);

      // Bar
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      doc.fillColor(colors[idx % colors.length])
        .rect(barX, chartY, barWidth, Math.max(barHeight, 2))
        .fill();

      // Label
      doc.fillColor('#64748b')
        .fontSize(8)
        .font('Helvetica')
        .text(item.make, barX, chartY + chartHeight + 5, { width: barWidth });
      doc.text(`${item.count}`, barX, chartY - 5, { width: barWidth });
    });
  }

  private generatePerformanceMetrics(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('PERFORMANCE METRICS', 80, 80);

    doc.moveDown(2);

    // Get KPIs or use defaults (0)
    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const atv = data.salesData?.kpis?.atv || 0;
    const avgPrice = data.salesData?.kpis?.avgPrice || 0;
    const salesPerEmployee = data.salesData?.kpis?.salesPerEmployee || 0;
    const totalSalesCount = data.salesData?.summary?.totalSalesCount || 0;
    const totalVehicles = data.salesData?.summary?.totalVehicles || 0;
    const employees = data.salesData?.summary?.employees || 0;

    const kpis = [
      {
        name: 'Inventory Turnover',
        value: inventoryTurnover,
        unit: '%',
        target: 20,
        status: inventoryTurnover >= 20 ? 'good' : 'warning',
        calculation: `(Total Sales / (Total Sales + Total Stok)) × 100`,
        explanation: `(${totalSalesCount} / (${totalSalesCount} + ${totalVehicles})) × 100 = ${inventoryTurnover}%`,
      },
      {
        name: 'Average Transaction Value (ATV)',
        value: atv,
        unit: '%',
        target: 80,
        status: atv >= 80 ? 'good' : 'warning',
        calculation: `(Avg Price / Industry Average) × 100`,
        explanation: `(Rp ${this.formatNumber(avgPrice)} / Rp 150.000.000) × 100 = ${atv}%`,
      },
      {
        name: 'Sales per Employee',
        value: salesPerEmployee,
        unit: '%',
        target: 80,
        status: salesPerEmployee >= 80 ? 'good' : 'warning',
        calculation: `(Total Sales / (Karyawan × 2)) × 100`,
        explanation: `(${totalSalesCount} / (${employees} × 2)) × 100 = ${salesPerEmployee}%`,
      },
    ];

    kpis.forEach((kpi, idx) => {
      this.drawKPIBox(80, doc.y, 470, kpi);
      doc.moveDown(1);
    });
  }

  private drawKPIBox(
    x: number,
    y: number,
    width: number,
    kpi: {
      name: string;
      value: number;
      unit: string;
      target: number;
      status: string;
      calculation: string;
      explanation: string;
    }
  ) {
    const { doc } = this;

    const height = 80;
    const bgColor = kpi.status === 'good' ? '#dcfce7' : '#fef3c7';
    const statusColor = kpi.status === 'good' ? '#15803d' : '#b45309';
    const statusIcon = kpi.status === 'good' ? '✅' : '⚠️';

    // Box
    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    // Status Icon
    doc.fontSize(20).text(statusIcon, x + 15, y + 15);

    // KPI Name
    doc.fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(kpi.name, x + 50, y + 18);

    // Value
    doc.fillColor(statusColor)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(`${kpi.value}${kpi.unit}`, x + 15, y + 45);

    // Target
    doc.fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(`Target: ${kpi.target}${kpi.unit}`, x + 15, y + 62);
    doc.text(`Gap: ${kpi.value >= kpi.target ? 0 : kpi.target - kpi.value}${kpi.unit}`, x + 150, y + 62);

    // Calculation
    doc.fillColor('#94a3b8')
      .fontSize(8)
      .font('Helvetica')
      .text(`Rumus: ${kpi.calculation}`, x + 250, y + 25, { width: 220 });

    doc.text(`Perhitungan: ${kpi.explanation}`, x + 250, y + 40, { width: 220 });
  }

  private generateWhatsAppAnalytics(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('WHATSAPP AI ANALYTICS', 80, 80);

    doc.moveDown(2);

    // ALWAYS SHOW - use defaults if no data
    const totalConversations = data.whatsappData?.overview?.totalConversations || 0;
    const activeConversations = data.whatsappData?.overview?.activeConversations || 0;
    const escalatedConversations = data.whatsappData?.overview?.escalatedConversations || 0;
    const aiResponseRate = data.whatsappData?.overview?.aiResponseRate || 0;
    const avgResponseTime = data.whatsappData?.overview?.avgResponseTime || 0;
    const aiAccuracy = data.whatsappData?.overview?.aiAccuracy || 0;
    const intentBreakdown = data.whatsappData?.intentBreakdown || [];

    // Overview Metrics - ALWAYS SHOW
    const metrics = [
      { label: 'Total Conversations', value: totalConversations.toString() },
      { label: 'Active Conversations', value: activeConversations.toString() },
      { label: 'Escalated to Staff', value: escalatedConversations.toString() },
      { label: 'AI Response Rate', value: `${aiResponseRate}%` },
      { label: 'Avg Response Time', value: `${avgResponseTime} detik` },
      { label: 'AI Accuracy', value: `${aiAccuracy}%` },
    ];

    metrics.forEach((metric, idx) => {
      const y = doc.y + 20;
      doc.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff')
        .rect(80, doc.y, 470, 30)
        .fill();

      doc.fillColor('#475569')
        .fontSize(10)
        .font('Helvetica')
        .text(metric.label, 85, y + 18);

      doc.fillColor('#1e40af')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(metric.value, 350, y + 18);

      doc.y += 30;
    });

    doc.moveDown(2);

    // Intent Breakdown - ALWAYS SHOW
    doc.fontSize(14)
      .fillColor('#334155')
      .font('Helvetica-Bold')
      .text('Breakdown Intent Customer', 80, doc.y, { underline: true });

    doc.moveDown(1);

    if (intentBreakdown.length === 0) {
      doc.fontSize(10)
        .fillColor('#94a3b8')
        .text('Tidak ada data percakapan untuk periode ini', 80, doc.y);
    } else {
      this.drawDonutChart(intentBreakdown, 80, doc.y, 200, 100);
    }
  }

  private drawDonutChart(
    data: Array<{ intent: string; count: number; percentage: number }>,
    x: number,
    y: number,
    size: number,
    labelHeight: number
  ) {
    const { doc } = this;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Draw horizontal bar chart instead of donut (simpler and more reliable)
    const maxCount = Math.max(...data.map((item) => item.count), 1);
    let barY = y;

    data.forEach((item, idx) => {
      const barWidth = (item.count / maxCount) * (size - 100);
      const color = colors[idx % colors.length];

      // Draw label
      doc.fillColor('#475569')
        .fontSize(9)
        .font('Helvetica')
        .text(`${item.intent}`, x, barY + 8);

      // Draw bar background
      doc.fillColor('#f1f5f9')
        .rect(x + 100, barY + 5, size - 100, 16)
        .fill();

      // Draw bar
      doc.fillColor(color)
        .rect(x + 100, barY + 5, barWidth, 16)
        .fill();

      // Draw percentage
      doc.fillColor('#64748b')
        .fontSize(8)
        .text(`${item.percentage}%`, x + 100 + barWidth + 5, barY + 8);

      barY += 25;
    });
  }

  private generateRecommendations(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#1e40af')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('REKOMENDASI & ACTION ITEMS', 80, 80);

    doc.moveDown(2);

    const recommendations = this.generateRecommendationsList(data);

    recommendations.forEach((rec, idx) => {
      const y = doc.y + 10;

      // Priority indicator
      const priorityColor = rec.priority === 'high' ? '#fee2e2' : rec.priority === 'medium' ? '#fef3c7' : '#dcfce7';
      const priorityText = rec.priority === 'high' ? '🔴 HIGH' : rec.priority === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';

      doc.fillColor(priorityColor).rect(80, y, 470, 60).fill();

      doc.fontSize(10)
        .fillColor('#991b1b')
        .font('Helvetica-Bold')
        .text(priorityText, 90, y + 12);

      doc.fillColor('#1e293b')
        .fontSize(12)
        .text(`${idx + 1}. ${rec.title}`, 90, y + 30);

      doc.fillColor('#475569')
        .fontSize(9)
        .font('Helvetica')
        .text(rec.description, 90, y + 48, { width: 450 });

      doc.y += 60;
      doc.moveDown(0.5);
    });
  }

  private generateRecommendationsList(data: ReportData) {
    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
    }> = [];

    // Sales Recommendations - ALWAYS SHOW
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const salesPerEmployee = data.salesData?.kpis?.salesPerEmployee || 0;
    const byMake = data.salesData?.byMake || [];

    if (salesCount === 0) {
      recommendations.push({
        priority: 'high',
        title: 'TINGKATKAN AKTIVITAS MARKETING',
        description: 'Belum ada penjualan periode ini. Perlu increase promosi, advertising, dan aktivitas sales. Pertimbangkan: - Promo diskon khusus - Bundle deals - Follow up leads yang belum convert',
      });
    }

    if (inventoryTurnover < 20) {
      recommendations.push({
        priority: 'medium',
        title: 'EVALUASI MEREK KURANG LAKU',
        description: `Inventory turnover hanya ${inventoryTurnover}%. Review merek yang stok tinggi dan pertimbangkan: - Clearance sale untuk stok lama - Promo khusus merek slow-moving - Bundling dengan merek fast-moving`,
      });
    }

    if (salesPerEmployee < 80) {
      recommendations.push({
        priority: 'medium',
        title: 'TRAINING & MOTIVASI SALES STAFF',
        description: `Productivitas sales ${salesPerEmployee}%. Pertimbangkan: - Training teknik negosiasi - Incentive program untuk target - Coaching dari top performer - Review dan improve sales script`,
      });
    }

    if (byMake.length > 0) {
      const topMake = byMake[0];
      recommendations.push({
        priority: 'low',
        title: `FOCUS PADA ${topMake.make.toUpperCase()}`,
        description: `${topMake.make} adalah merek terlaris (${topMake.count} unit). Pertimbangkan: - Increase stok varian ${topMake.make} - Special promo untuk ${topMake.make} - Training sales khusus produk ${topMake.make}`,
      });
    }

    // WhatsApp AI Recommendations - ALWAYS SHOW
    const aiAccuracy = data.whatsappData?.overview?.aiAccuracy || 0;
    if (aiAccuracy < 80 && aiAccuracy > 0) {
      recommendations.push({
        priority: 'high',
        title: 'IMPROVE AI ACCURACY',
        description: `AI accuracy hanya ${aiAccuracy}%. Banyak percakapan di-escalate ke staff. Action: - Review percakapan yang failed - Improve prompt AI - Tambah knowledge base - Update FAQ dan product info`,
      });
    } else if (aiAccuracy === 0) {
      recommendations.push({
        priority: 'low',
        title: 'MONITOR AI PERFORMANCE',
        description: 'Belum ada data percakapan AI. Mulai monitor performa AI ketika ada percakapan masuk untuk ensure accuracy tetap tinggi.',
      });
    }

    // Always add general recommendations if list is short
    if (recommendations.length < 3) {
      recommendations.push({
        priority: 'low',
        title: 'MONITOR METRICS HARIAN',
        description: 'Review dashboard analytics harian untuk track performa dan identify trends. Early detection memungkinkan corrective action lebih cepat.',
      });
    }

    return recommendations;
  }

  private generateFooter(data: ReportData) {
    const { doc } = this;

    doc.fillColor('#f1f5f9')
      .fontSize(10)
      .fillColor('#64748b')
      .font('Helvetica')
      .text('Laporan ini dibuat secara otomatis oleh sistem AutoLumiKu', 80, doc.y, { align: 'center' });

    doc.moveDown();
    doc.text('Data diambil dari sistem internal Prima Mobil', doc.page.width / 2, doc.y, { align: 'center' });

    doc.moveDown();
    doc.fontSize(8)
      .fillColor('#94a3b8')
      .text(`Generated: ${new Date().toLocaleString('id-ID')}`, doc.page.width / 2, doc.y, { align: 'center' });
    doc.text('Untuk pertanyaan, hubungi tim support', doc.page.width / 2, doc.y + 12, { align: 'center' });
  }

  // Helper functions
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
  }
}
