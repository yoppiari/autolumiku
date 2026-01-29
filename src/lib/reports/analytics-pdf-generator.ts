/**
 * Professional Analytics PDF Generator
 * Creates professional 2-page PDF reports for showroom analytics
 * with visible donut charts, formulas, and clean layout
 */

import PDFDocument from 'pdfkit';
import { createPDFDocument } from '@/lib/services/whatsapp-ai/utils/pdf-init';

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

  constructor() {
    this.doc = createPDFDocument();
    this.doc.info['Producer'] = 'AutoLumiKu Analytics';
    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(data: ReportData): Promise<Buffer> {
    console.log('[AnalyticsPDFGenerator] 🚀 Starting 2-page professional PDF');
    console.log('[AnalyticsPDFGenerator] 📊 Tenant:', data.tenantName);
    console.log('[AnalyticsPDFGenerator] 📅 Period:', data.startDate, 'to', data.endDate);

    // PAGE 1: Executive Dashboard with Charts
    this.doc.addPage();
    this.generatePage1(data);

    // PAGE 2: Formulas & Analysis
    this.doc.addPage();
    this.generatePage2(data);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[AnalyticsPDFGenerator] ✅ PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generatePage1(data: ReportData) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const maxY = pageHeight - 40;

    // Header
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, 55).fill();

    doc.fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('LAPORAN ANALITIK SHOWROOM', 20, 15);

    doc.fontSize(12)
      .font('Helvetica')
      .text(data.tenantName.toUpperCase(), 20, 35);

    doc.fontSize(8)
      .fillColor('#93c5fd')
      .text(`Periode: ${this.formatDate(data.startDate)} - ${this.formatDate(data.endDate)}`, pageWidth - 25, 20, { align: 'right' });
    doc.text(`Dibuat: ${this.formatDate(new Date())}`, pageWidth - 25, 32, { align: 'right' });

    // Metrics Cards - Sales Data
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const salesValue = data.salesData?.summary?.totalSalesValue || 0;
    const avgPrice = data.salesData?.kpis?.avgPrice || 0;
    const inventoryCount = data.salesData?.summary?.totalVehicles || 0;

    const cardWidth = (pageWidth - 40) / 3 - 8;
    const cardHeight = 70;
    const startY = 63;
    const gap = 8;

    // Row 1 - Sales Metrics
    this.drawMetricCard(20, startY, cardWidth, cardHeight, '#3b82f6', 'TOTAL PENJUALAN',
      `${salesCount} Unit`, 'COUNT(vehicle) WHERE status = SOLD');

    this.drawMetricCard(20 + cardWidth + gap, startY, cardWidth, cardHeight, '#10b981',
      'TOTAL REVENUE', this.formatCurrency(salesValue), 'SUM(price) WHERE status = SOLD');

    this.drawMetricCard(20 + (cardWidth + gap) * 2, startY, cardWidth, cardHeight, '#f59e0b',
      'RATA-RATA HARGA', this.formatCurrency(avgPrice), 'AVG(price) WHERE status = SOLD');

    // Row 2 - Inventory & KPIs
    const y2 = startY + cardHeight + gap;
    this.drawMetricCard(20, y2, cardWidth, cardHeight, '#8b5cf6',
      'TOTAL STOK', `${inventoryCount} Unit`, 'COUNT(vehicle) WHERE status = AVAILABLE');

    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const atv = data.salesData?.kpis?.atv || 0;

    this.drawMetricCard(20 + cardWidth + gap, y2, cardWidth, cardHeight, '#ef4444',
      'INVENTORY TURNOVER', `${inventoryTurnover}%`, '(sold / (sold + stock)) * 100');

    this.drawMetricCard(20 + (cardWidth + gap) * 2, y2, cardWidth, cardHeight, '#ec4899',
      'ATV', `${atv}%`, '(avgPrice / 150M) * 100');

    let chartY = y2 + cardHeight + gap + 10;

    // SALES BY MAKE CHART - Always visible
    const byMake = data.salesData?.byMake || [];
    if (chartY + 130 < maxY) {
      doc.fontSize(11)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('PENJUALAN PER MEREK', 20, chartY);

      chartY += 25;

      // Draw donut chart on left
      const chartData = byMake.slice(0, 5).map((item, idx) => ({
        label: item.make,
        value: item.count,
        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
      }));

      this.drawDonutChart(20, chartY, 110, chartData);

      // Legend on right
      const legendX = 140;
      let legendY = chartY;
      chartData.forEach((item) => {
        doc.fillColor(item.color).rect(legendX, legendY, 10, 10).fill();
        doc.fillColor('#1e293b')
          .fontSize(9)
          .font('Helvetica')
          .text(`${item.label}: ${item.value} unit`, legendX + 15, legendY + 8);
        legendY += 18;
      });
    }

    // Footer Page 1
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 1 of 2 | Laporan Analitik Profesional', pageWidth / 2, pageHeight - 14, { align: 'center' });
  }

  private generatePage2(data: ReportData) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const maxY = pageHeight - 40;

    // Header
    doc.fillColor('#1e40af')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN & ANALISIS DETAIL', 20, 20);

    doc.moveTo(20, 35)
      .lineTo(pageWidth - 20, 35)
      .lineWidth(0.5)
      .stroke('#e5e7eb');

    let y = 50;

    // SALES METRICS WITH FORMULAS
    doc.fontSize(10)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('METRIK PENJUALAN', 20, y);

    y += 12;

    const salesMetrics = [
      {
        label: 'Total Penjualan',
        value: `${data.salesData?.summary?.totalSalesCount || 0} Unit`,
        color: '#3b82f6',
        formula: 'COUNT(vehicle) WHERE status = SOLD',
        calc: `${data.salesData?.summary?.totalSalesCount || 0} unit terjual`
      },
      {
        label: 'Total Revenue',
        value: this.formatCurrency(data.salesData?.summary?.totalSalesValue || 0),
        color: '#10b981',
        formula: 'SUM(price) WHERE status = SOLD',
        calc: this.formatCurrency(data.salesData?.summary?.totalSalesValue || 0)
      },
      {
        label: 'Rata-rata Harga',
        value: this.formatCurrency(data.salesData?.kpis?.avgPrice || 0),
        color: '#f59e0b',
        formula: 'AVG(price) WHERE status = SOLD',
        calc: `${this.formatCurrency(data.salesData?.summary?.totalSalesValue || 0)} / ${(data.salesData?.summary?.totalSalesCount || 1)}`
      },
    ];

    salesMetrics.forEach((metric, idx) => {
      if (y + 42 < maxY) {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.fillColor(bgColor).rect(20, y, pageWidth - 40, 40).fill();
        doc.fillColor(metric.color).rect(20, y, 4, 40).fill();

        doc.fillColor('#1e293b')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(metric.label, 30, y + 6);

        doc.fillColor(metric.color)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(metric.value, pageWidth - 120, y + 6);

        doc.fillColor('#94a3b8')
          .fontSize(6)
          .font('Helvetica-Oblique')
          .text(`R: ${metric.formula}`, 30, y + 18);

        doc.fillColor('#6b7280')
          .fontSize(6)
          .font('Helvetica')
          .text(`H: ${metric.calc}`, 30, y + 28);

        y += 43;
      }
    });

    // WHATSAPP AI METRICS
    if (y + 50 < maxY && data.whatsappData) {
      y += 8;
      doc.fontSize(10)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('METRIK WHATSAPP AI', 20, y);

      y += 12;

      const waMetrics = [
        {
          label: 'Total Conversations',
          value: `${data.whatsappData.overview.totalConversations}`,
          color: '#8b5cf6',
          formula: 'COUNT(conversations)',
          calc: `${data.whatsappData.overview.totalConversations} percakapan`
        },
        {
          label: 'AI Response Rate',
          value: `${data.whatsappData.overview.aiResponseRate}%`,
          color: '#ec4899',
          formula: '(AI responses / Customer messages) * 100',
          calc: `${data.whatsappData.overview.aiResponseRate}% rate`
        },
      ];

      waMetrics.forEach((metric, idx) => {
        if (y + 42 < maxY) {
          const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.fillColor(bgColor).rect(20, y, pageWidth - 40, 40).fill();
          doc.fillColor(metric.color).rect(20, y, 4, 40).fill();

          doc.fillColor('#1e293b')
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(metric.label, 30, y + 6);

          doc.fillColor(metric.color)
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(metric.value, pageWidth - 120, y + 6);

          doc.fillColor('#94a3b8')
            .fontSize(6)
            .font('Helvetica-Oblique')
            .text(`R: ${metric.formula}`, 30, y + 18);

          doc.fillColor('#6b7280')
            .fontSize(6)
            .font('Helvetica')
            .text(`H: ${metric.calc}`, 30, y + 28);

          y += 43;
        }
      });
    }

    // Footer
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 2 of 2 | Laporan Analitik Profesional', pageWidth / 2, pageHeight - 14, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(6)
      .text(`Generated by AutoLumiKu | ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  }

  private drawMetricCard(x: number, y: number, width: number, height: number, color: string, label: string, value: string, formula: string) {
    const { doc } = this;

    doc.fillColor(color).rect(x, y, width, height).fill();

    doc.fillColor('#ffffff')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(label.toUpperCase(), x + 5, y + 10);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text(value, x + 5, y + 25);

    doc.fontSize(6)
      .font('Helvetica-Oblique')
      .fillColor('rgba(255,255,255,0.8)')
      .text('Rumus tersedia →', x + 5, y + 50);
  }

  private drawDonutChart(x: number, y: number, size: number, data: { label: string; value: number; color: string }[]) {
    const { doc } = this;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = (size / 2 - 10);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let startAngle = 0;

    data.forEach((item) => {
      if (total === 0) return;

      const percentage = item.value / total;
      const angle = percentage * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const startX = centerX + radius * Math.cos(startAngle);
      const startY = centerY + radius * Math.sin(startAngle);
      const endX = centerX + radius * Math.cos(endAngle);
      const endY = centerY + radius * Math.sin(endAngle);

      doc.path(`M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${angle > Math.PI ? 1 : 0} ${endX} ${endY} Z`)
        .fill(item.color);

      startAngle = endAngle;
    });

    // Draw white circle in center (donut hole)
    const innerRadius = radius * 0.5;
    doc.fillColor('#ffffff')
      .circle(centerX, centerY, innerRadius)
      .fill();

    // Total in center
    doc.fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`${total}`, centerX, centerY - 5, { align: 'center', width: size });

    doc.fillColor('#64748b')
      .fontSize(7)
      .font('Helvetica')
      .text('TOTAL', centerX, centerY + 8, { align: 'center', width: size });
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
