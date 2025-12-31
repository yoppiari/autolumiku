/**
 * Compact Executive Summary PDF Generator - FIXED VERSION
 * Creates a TRUE 2-page executive summary with donut chart
 * Optimized for owner/management review
 */

import PDFDocument from 'pdfkit';

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

interface ReportData {
  tenantName: string;
  logoUrl?: string;
  salesData: SalesData | null;
  startDate: Date;
  endDate: Date;
}

export class CompactExecutivePDF {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 20,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(data: ReportData): Promise<Buffer> {
    console.log('[CompactExecutivePDF] 🚀 Generating TRUE 2-page executive summary');

    // Get data or use defaults
    const salesCount = data.salesData?.summary?.totalSalesCount || 0;
    const salesValue = data.salesData?.summary?.totalSalesValue || 0;
    const totalVehicles = data.salesData?.summary?.totalVehicles || 0;
    const employees = data.salesData?.summary?.employees || 0;
    const avgPrice = data.salesData?.kpis?.avgPrice || 0;
    const inventoryTurnover = data.salesData?.kpis?.inventoryTurnover || 0;
    const atv = data.salesData?.kpis?.atv || 0;
    const salesPerEmployee = data.salesData?.kpis?.salesPerEmployee || 0;
    const byMake = data.salesData?.byMake || [];
    const topPerformers = data.salesData?.topPerformers || [];

    // PAGE 1: Executive Dashboard - COMPACT
    this.doc.addPage();
    this.generatePage1Compact(data, {
      salesCount,
      salesValue,
      totalVehicles,
      employees,
      avgPrice,
      byMake,
      topPerformers,
    });

    // PAGE 2: KPIs & Insights - COMPACT
    this.doc.addPage();
    this.generatePage2Compact(data, {
      salesCount,
      salesValue,
      totalVehicles,
      employees,
      avgPrice,
      inventoryTurnover,
      atv,
      salesPerEmployee,
      byMake,
    });

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[CompactExecutivePDF] ✅ TRUE 2-page PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generatePage1Compact(data: ReportData, metrics: any) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Header - more compact
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, 50).fill();

    doc.fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('LAPORAN EXECUTIVE', 20, 15);

    // Logo or tenant name
    if (data.logoUrl) {
      try {
        // Display logo image (max width 80px, max height 30px)
        doc.image(data.logoUrl, 20, 32, {
          fit: [80, 30],
        });
      } catch (error) {
        console.error('[CompactExecutivePDF] ❌ Failed to load logo:', error);
        // Fallback to text if logo fails
        doc.fontSize(12)
          .font('Helvetica')
          .text(data.tenantName.toUpperCase(), 20, 32);
      }
    } else {
      // No logo, use tenant name text
      doc.fontSize(12)
        .font('Helvetica')
        .text(data.tenantName.toUpperCase(), 20, 32);
    }

    doc.fontSize(8)
      .fillColor('#93c5fd')
      .text(`${this.formatDate(data.startDate)} - ${this.formatDate(data.endDate)}`, pageWidth - 20, 20, { align: 'right' });
    doc.text(`Dicetak: ${this.formatDate(new Date())}`, pageWidth - 20, 30, { align: 'right' });

    // Key Metrics Cards - Top Row (4 cards) - COMPACT
    const cardWidth = (pageWidth - 40) / 4 - 6;
    const cardHeight = 60;
    const startY = 58;
    const gap = 6;

    // Card 1: Total Sales
    this.drawCompactCard(20, startY, cardWidth, cardHeight,
      '#3b82f6', '#ffffff',
      'PENJUALAN',
      `${metrics.salesCount}`,
      'UNIT'
    );

    // Card 2: Revenue
    this.drawCompactCard(20 + cardWidth + gap, startY, cardWidth, cardHeight,
      '#10b981', '#ffffff',
      'REVENUE',
      this.formatCompactNumber(metrics.salesValue),
      'Rp'
    );

    // Card 3: Stok
    this.drawCompactCard(20 + (cardWidth + gap) * 2, startY, cardWidth, cardHeight,
      '#f59e0b', '#ffffff',
      'STOK',
      `${metrics.totalVehicles}`,
      'UNIT'
    );

    // Card 4: Conversion Rate
    const conversionRate = (metrics.salesCount / (metrics.salesCount + metrics.totalVehicles)) * 100;
    this.drawCompactCard(20 + (cardWidth + gap) * 3, startY, cardWidth, cardHeight,
      conversionRate >= 20 ? '#10b981' : conversionRate >= 10 ? '#f59e0b' : '#ef4444',
      '#ffffff',
      'CONVERSION',
      `${conversionRate.toFixed(0)}%`,
      ''
    );

    // DONUT CHART - Sales by Make
    let y = startY + cardHeight + 10;

    doc.fontSize(11)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('DISTRIBUSI PENJUALAN PER MEREK (DONUT CHART)', 20, y);

    y += 25;

    if (metrics.byMake.length > 0) {
      // Draw donut chart on left side
      this.drawDonutChart(20, y, 150, metrics.byMake);

      // Draw legend on right side
      const legendX = 180;
      let legendY = y;
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

      metrics.byMake.slice(0, 5).forEach((item: any, idx: number) => {
        const color = colors[idx % colors.length];

        // Color box
        doc.fillColor(color).rect(legendX, legendY, 12, 12).fill();

        // Text
        doc.fillColor('#1e293b')
          .fontSize(9)
          .font('Helvetica')
          .text(`${item.make}: ${item.count} unit (${this.formatNumber(item.value)})`, legendX + 18, legendY + 8);

        legendY += 18;
      });
    } else {
      doc.fillColor('#9ca3af')
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text('Belum ada data penjualan', 20, y);
      y += 20;
    }

    // Top Salesperson - Compact
    y = 270;

    doc.fontSize(11)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('TOP SALESPERSON', 20, y);

    y += 15;

    if (metrics.topPerformers.length > 0) {
      const top = metrics.topPerformers[0];
      doc.fillColor('#f0f9ff')
        .rect(20, y, pageWidth - 40, 40)
        .fill();

      doc.fillColor('#3b82f6')
        .fontSize(20)
        .text('🏆', 25, y + 12);

      doc.fillColor('#1e293b')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(top.name, 50, y + 10);

      doc.fillColor('#64748b')
        .fontSize(9)
        .font('Helvetica')
        .text(`${top.count} unit terjual`, 50, y + 23);

      doc.fillColor('#10b981')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(this.formatCompactNumber(top.value), pageWidth - 60, y + 18);
    } else {
      doc.fillColor('#9ca3af')
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text('Belum ada data performa staff', 20, y);
    }

    // Footer Page 1
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 1 of 2 | Executive Summary', pageWidth / 2, pageHeight - 14, { align: 'center' });
  }

  private generatePage2Compact(data: ReportData, metrics: any) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Header
    doc.fillColor('#1e40af')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('KPI PERFORMANCE & INSIGHTS', 20, 20);

    doc.moveTo(20, 35)
      .lineTo(pageWidth - 20, 35)
      .lineWidth(0.5)
      .stroke('#e5e7eb');

    let y = 45;

    // 3 KPIs in compact format - each 40px tall
    y = this.drawCompactKPI(doc, y, pageWidth,
      'INVENTORY TURNOVER',
      `${metrics.inventoryTurnover}%`,
      metrics.inventoryTurnover >= 20 ? '✅ BAIK' : '⚠️ ATTENTION',
      `(Total Sales / (Total Sales + Stok)) × 100`,
      `(${metrics.salesCount} / (${metrics.salesCount} + ${metrics.totalVehicles})) × 100 = ${metrics.inventoryTurnover}%`,
      metrics.inventoryTurnover >= 20 ? '#10b981' : '#f59e0b'
    );

    y = this.drawCompactKPI(doc, y, pageWidth,
      'AVERAGE TRANSACTION VALUE',
      `${metrics.atv}%`,
      metrics.atv >= 80 ? '✅ KOMPETITIF' : metrics.atv >= 60 ? '📊 WAJAR' : '⚠️ DI BAWAH RATA-RATA',
      `(Avg Price / Industry Avg) × 100`,
      `(Rp ${this.formatNumber(metrics.avgPrice)} / Rp 150jt) × 100 = ${metrics.atv}%`,
      metrics.atv >= 80 ? '#10b981' : metrics.atv >= 60 ? '#f59e0b' : '#ef4444'
    );

    y = this.drawCompactKPI(doc, y, pageWidth,
      'SALES PER EMPLOYEE',
      `${metrics.salesPerEmployee}%`,
      metrics.salesPerEmployee >= 80 ? '✅ SANGAT BAIK' : metrics.salesPerEmployee >= 60 ? '📊 BAIK' : '⚠️ PERLU TRAINING',
      `(Total Sales / (Staff × 2)) × 100`,
      `(${metrics.salesCount} / (${metrics.employees} × 2)) × 100 = ${metrics.salesPerEmployee}%`,
      metrics.salesPerEmployee >= 80 ? '#10b981' : metrics.salesPerEmployee >= 60 ? '#f59e0b' : '#ef4444'
    );

    // Insights Section - Compact
    y += 8;

    doc.fontSize(11)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('KEY INSIGHTS', 20, y);

    y += 12;

    const insights = this.generateInsights(metrics);

    // Draw 3 insights in 2 columns
    insights.slice(0, 4).forEach((insight, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const xOffset = col === 0 ? 20 : pageWidth / 2 + 10;
      const yOffset = y + (row * 45);

      if (yOffset + 40 < pageHeight - 30) {
        this.drawInsightBoxCompact(xOffset, yOffset, pageWidth / 2 - 30, 40, insight.color, insight.icon, insight.title, insight.text);
      }
    });

    // Footer
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 2 of 2 | Executive Summary', pageWidth / 2, pageHeight - 14, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(6)
      .text(`Generated by AutoLumiKu | ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  }

  private drawCompactCard(
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: string,
    textColor: string,
    title: string,
    value: string,
    unit: string
  ) {
    const { doc } = this;

    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    doc.fillColor(textColor)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(title, x + 5, y + 8);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text(value, x + 5, y + 20);

    if (unit) {
      doc.fontSize(8)
        .font('Helvetica')
        .text(unit, x + 5, y + 40);
    }
  }

  private drawDonutChart(x: number, y: number, size: number, data: any[]) {
    const { doc } = this;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = (size / 2 - 10);

    const total = data.reduce((sum: number, item: any) => sum + item.count, 0);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Draw pie slices using simple paths
    let startAngle = 0;

    data.forEach((item: any, idx: number) => {
      if (total === 0) return;

      const percentage = item.count / total;
      const angle = percentage * 2 * Math.PI;
      const endAngle = startAngle + angle;

      // Calculate points for the pie slice
      const startX = centerX + radius * Math.cos(startAngle);
      const startY = centerY + radius * Math.sin(startAngle);
      const endX = centerX + radius * Math.cos(endAngle);
      const endY = centerY + radius * Math.sin(endAngle);

      // Draw the pie slice path
      doc.path(`M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${angle > Math.PI ? 1 : 0} ${endX} ${endY} Z`)
        .fill(colors[idx % colors.length]);

      startAngle = endAngle;
    });

    // Draw white circle in center (donut hole)
    const innerRadius = radius * 0.5;
    doc.fillColor('#ffffff')
      .circle(centerX, centerY, innerRadius)
      .fill();

    // Total in center
    doc.fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`${total}`, centerX, centerY - 5, { align: 'center', width: size });

    doc.fillColor('#64748b')
      .fontSize(7)
      .font('Helvetica')
      .text('TOTAL', centerX, centerY + 8, { align: 'center', width: size });
  }

  private drawCompactKPI(
    doc: PDFKit.PDFDocument,
    y: number,
    pageWidth: number,
    title: string,
    value: string,
    status: string,
    formula: string,
    calculation: string,
    color: string
  ): number {
    // KPI Box - compact 40px height
    doc.fillColor('#f9fafb')
      .rect(20, y, pageWidth - 40, 40)
      .fill();

    // Left colored bar
    doc.fillColor(color)
      .rect(20, y, 4, 40)
      .fill();

    // Title & Value
    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(title, 30, y + 6);

    doc.fillColor(color)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(value, pageWidth - 120, y + 5);

    // Status
    doc.fillColor('#64748b')
      .fontSize(8)
      .font('Helvetica')
      .text(status, pageWidth - 120, y + 18);

    // Formula (small)
    doc.fillColor('#94a3b8')
      .fontSize(6)
      .font('Helvetica-Oblique')
      .text(`Rumus: ${formula}`, 30, y + 22);

    // Calculation (small)
    doc.fillColor('#6b7280')
      .fontSize(6)
      .font('Helvetica')
      .text(`Hitung: ${calculation}`, 30, y + 31);

    return y + 43;
  }

  private drawInsightBoxCompact(
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

    doc.fontSize(12).text(icon, x + 5, y + 8);

    doc.fillColor('#1e293b')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(title, x + 22, y + 8);

    doc.fillColor('#475569')
      .fontSize(7)
      .font('Helvetica')
      .text(text, x + 22, y + 22, { width: width - 30 });
  }

  private generateInsights(metrics: any): Array<{
    color: string;
    icon: string;
    title: string;
    text: string;
  }> {
    const insights = [];

    if (metrics.salesCount === 0) {
      insights.push({
        color: '#fef3c7',
        icon: '⚠️',
        title: 'BELUM ADA PENJUALAN',
        text: 'Periode ini belum ada penjualan. Perlu review strategi marketing.',
      });
    } else if (metrics.salesCount < 5) {
      insights.push({
        color: '#fee2e2',
        icon: '📉',
        title: 'PENJUALAN RENDAH',
        text: `Hanya ${metrics.salesCount} unit terjual. Perlu increase promosi.`,
      });
    }

    if (metrics.inventoryTurnover < 20) {
      insights.push({
        color: '#fef3c7',
        icon: '📦',
        title: 'STOK TINGGI',
        text: `Inventory turnover ${metrics.inventoryTurnover}%. Stok belum optimal.`,
      });
    }

    if (metrics.atv < 60) {
      insights.push({
        color: '#fee2e2',
        icon: '💡',
        title: 'HARGA PERLU DITINGKATKAN',
        text: `ATV ${metrics.atv}% dari industri. Pertimbangkan pricing strategy.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        color: '#dcfce7',
        icon: '✅',
        title: 'PERFORMA BAIK',
        text: `${metrics.salesCount} unit terjual dengan Rp ${this.formatNumber(metrics.salesValue)}.`,
      });
    }

    return insights;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
  }

  private formatCompactNumber(num: number): string {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + ' M';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + ' Jt';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + ' K';
    }
    return this.formatNumber(num);
  }
}
