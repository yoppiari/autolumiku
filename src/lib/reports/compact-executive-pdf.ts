/**
 * Compact Executive Summary PDF Generator
 * Creates a professional 2-page executive summary for showroom analytics
 * Optimized for owner/management review - no wasted space
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
      margin: 30,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(data: ReportData): Promise<Buffer> {
    console.log('[CompactExecutivePDF] 🚀 Starting 2-page executive summary generation');
    console.log('[CompactExecutivePDF] 📊 Tenant:', data.tenantName);

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

    // PAGE 1: Executive Dashboard
    this.doc.addPage();
    this.generatePage1(data, {
      salesCount,
      salesValue,
      totalVehicles,
      employees,
      avgPrice,
      byMake,
      topPerformers,
    });

    // PAGE 2: KPIs & Insights
    this.doc.addPage();
    this.generatePage2(data, {
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
    console.log('[CompactExecutivePDF] ✅ 2-page PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generatePage1(data: ReportData, metrics: any) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Header with gradient background
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, 70).fill();

    doc.fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('LAPORAN EXECUTIVE', 30, 20);

    doc.fontSize(14)
      .font('Helvetica')
      .text(data.tenantName.toUpperCase(), 30, 45);

    doc.fontSize(10)
      .fillColor('#93c5fd')
      .text(`${this.formatDate(data.startDate)} - ${this.formatDate(data.endDate)}`, pageWidth - 30, 25, { align: 'right' });
    doc.text(`Dicetak: ${this.formatDate(new Date())}`, pageWidth - 30, 40, { align: 'right' });

    // Key Metrics Cards - Top Row (4 cards)
    const cardWidth = (pageWidth - 60) / 4 - 10;
    const cardHeight = 75;
    const startY = 85;
    const gap = 10;

    // Card 1: Total Sales
    this.drawCompactCard(30, startY, cardWidth, cardHeight,
      '#3b82f6', '#ffffff',
      'PENJUALAN',
      `${metrics.salesCount}`,
      'UNIT',
      metrics.salesCount > 0 ? '✅' : '⚠️'
    );

    // Card 2: Revenue
    this.drawCompactCard(30 + cardWidth + gap, startY, cardWidth, cardHeight,
      '#10b981', '#ffffff',
      'REVENUE',
      this.formatCompactNumber(metrics.salesValue),
      'Rp',
      '💰'
    );

    // Card 3: Stok
    this.drawCompactCard(30 + (cardWidth + gap) * 2, startY, cardWidth, cardHeight,
      '#f59e0b', '#ffffff',
      'STOK',
      `${metrics.totalVehicles}`,
      'UNIT',
      '📦'
    );

    // Card 4: Conversion Rate
    const conversionRate = (metrics.salesCount / (metrics.salesCount + metrics.totalVehicles)) * 100;
    this.drawCompactCard(30 + (cardWidth + gap) * 3, startY, cardWidth, cardHeight,
      conversionRate >= 20 ? '#10b981' : conversionRate >= 10 ? '#f59e0b' : '#ef4444',
      '#ffffff',
      'CONVERSION',
      `${conversionRate.toFixed(0)}%`,
      '',
      conversionRate >= 20 ? '✅' : '⚠️'
    );

    // Section: Top Performing Brands - with Chart
    let y = startY + cardHeight + 15;

    doc.fontSize(12)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('TOP PERFORMING BRANDS', 30, y);

    y += 20;

    if (metrics.byMake.length > 0) {
      // Draw horizontal bar chart
      const maxCount = Math.max(...metrics.byMake.map((m: any) => m.count));
      const barStartX = 100;
      const barY = y;
      const barHeight = 18;
      const maxBarWidth = pageWidth - 150;

      metrics.byMake.slice(0, 5).forEach((item: any, idx: number) => {
        const barWidth = maxCount > 0 ? (item.count / maxCount) * maxBarWidth : 0;
        const color = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5];

        // Label
        doc.fillColor('#374151')
          .fontSize(10)
          .font('Helvetica')
          .text(item.make, 30, barY + 4);

        // Bar background
        doc.fillColor('#f3f4f6').rect(barStartX, barY, maxBarWidth, barHeight).fill();

        // Bar
        doc.fillColor(color).rect(barStartX, barY, Math.max(barWidth, 2), barHeight).fill();

        // Value
        doc.fillColor('#6b7280')
          .fontSize(9)
          .text(`${item.count} unit`, barStartX + maxBarWidth + 10, barY + 4);

        y += barHeight + 4;
      });
    } else {
      doc.fillColor('#9ca3af')
        .fontSize(10)
        .font('Helvetica-Oblique')
        .text('Belum ada data penjualan', 30, y);
      y += 20;
    }

    // Section: Top Performer
    y += 10;

    doc.fontSize(12)
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .text('TOP SALESPERSON', 30, y);

    y += 20;

    if (metrics.topPerformers.length > 0) {
      const top = metrics.topPerformers[0];
      doc.fillColor('#ffffff')
        .rect(30, y, pageWidth - 60, 40)
        .fill();

      doc.fillColor('#dbeafe')
        .rect(30, y, 6, 40)
        .fill();

      doc.fillColor('#1e40af')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('🏆', 40, y + 12);

      doc.fillColor('#1e293b')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(top.name, 60, y + 10);

      doc.fillColor('#64748b')
        .fontSize(10)
        .font('Helvetica')
        .text(`${top.count} unit terjual`, 60, y + 25);

      doc.fillColor('#10b981')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(this.formatCompactNumber(top.value), pageWidth - 90, y + 18);

      y += 50;
    } else {
      doc.fillColor('#9ca3af')
        .fontSize(10)
        .font('Helvetica-Oblique')
        .text('Belum ada data performa staff', 30, y);
      y += 20;
    }

    // Footer for Page 1
    doc.fillColor('#f1f5f9')
      .rect(30, pageHeight - 25, pageWidth - 60, 20)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(8)
      .font('Helvetica')
      .text('Executive Summary - Page 1 of 2', pageWidth / 2, pageHeight - 18, { align: 'center' });
  }

  private generatePage2(data: ReportData, metrics: any) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Header
    doc.fillColor('#1e40af')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('KPI PERFORMANCE & INSIGHTS', 30, 30);

    doc.moveTo(30, 50)
      .lineTo(pageWidth - 30, 50)
      .lineWidth(1)
      .stroke('#e5e7eb');

    let y = 65;

    // KPI 1: Inventory Turnover
    y = this.drawKPIRow(doc, y, pageWidth,
      'INVENTORY TURNOVER',
      `${metrics.inventoryTurnover}%`,
      metrics.inventoryTurnover >= 20 ? '✅ BAIK' : '⚠️ PERLU ATTENTION',
      `(Total Sales / (Total Sales + Stok)) × 100`,
      `(${metrics.salesCount} / (${metrics.salesCount} + ${metrics.totalVehicles})) × 100 = ${metrics.inventoryTurnover}%`,
      metrics.inventoryTurnover >= 20 ? '#10b981' : '#f59e0b'
    );

    // KPI 2: Average Transaction Value
    y = this.drawKPIRow(doc, y, pageWidth,
      'AVERAGE TRANSACTION VALUE',
      `${metrics.atv}%`,
      metrics.atv >= 80 ? '✅ KOMPETITIF' : metrics.atv >= 60 ? '📊 WAJAR' : '⚠️ DI BAWAH RATA-RATA',
      `(Avg Price / Industry Avg) × 100`,
      `(Rp ${this.formatNumber(metrics.avgPrice)} / Rp 150jt) × 100 = ${metrics.atv}%`,
      metrics.atv >= 80 ? '#10b981' : metrics.atv >= 60 ? '#f59e0b' : '#ef4444'
    );

    // KPI 3: Sales per Employee
    y = this.drawKPIRow(doc, y, pageWidth,
      'SALES PER EMPLOYEE',
      `${metrics.salesPerEmployee}%`,
      metrics.salesPerEmployee >= 80 ? '✅ SANGAT BAIK' : metrics.salesPerEmployee >= 60 ? '📊 BAIK' : '⚠️ PERLU TRAINING',
      `(Total Sales / (Staff × 2)) × 100`,
      `(${metrics.salesCount} / (${metrics.employees} × 2)) × 100 = ${metrics.salesPerEmployee}%`,
      metrics.salesPerEmployee >= 80 ? '#10b981' : metrics.salesPerEmployee >= 60 ? '#f59e0b' : '#ef4444'
    );

    // Key Insights Section
    y += 15;

    doc.fillColor('#1e40af')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('KEY INSIGHTS', 30, y);

    y += 20;

    const insights = this.generateInsights(metrics);

    insights.forEach((insight) => {
      if (y + 35 > pageHeight - 40) {
        // Skip if would overflow
        return;
      }

      this.drawInsightBox(30, y, pageWidth - 60, 35, insight.color, insight.icon, insight.title, insight.text);
      y += 40;
    });

    // Recommendations
    if (y + 60 < pageHeight - 40) {
      y += 10;

      doc.fillColor('#1e40af')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('REKOMENDASI', 30, y);

      y += 20;

      const recommendations = this.generateRecommendations(metrics);

      recommendations.slice(0, 2).forEach((rec) => {
        if (y + 35 > pageHeight - 40) return;

        this.drawRecommendationBox(30, y, pageWidth - 60, 30, rec.priority, rec.text);
        y += 35;
      });
    }

    // Footer
    doc.fillColor('#f1f5f9')
      .rect(30, pageHeight - 25, pageWidth - 60, 20)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(8)
      .font('Helvetica')
      .text('Executive Summary - Page 2 of 2', pageWidth / 2, pageHeight - 18, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .text(`Generated by AutoLumiKu | ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
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
    unit: string,
    icon: string
  ) {
    const { doc } = this;

    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    doc.fillColor(textColor)
      .fontSize(18)
      .text(icon, x + 8, y + 8);

    doc.fontSize(8)
      .font('Helvetica-Bold')
      .text(title, x + 30, y + 10);

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(value, x + 8, y + 30);

    if (unit) {
      doc.fontSize(10)
        .font('Helvetica')
        .text(unit, x + 8, y + 50);
    }
  }

  private drawKPIRow(
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
    // KPI Box
    doc.fillColor('#f9fafb')
      .rect(30, y, pageWidth - 60, 55)
      .fill();

    // Left colored bar
    doc.fillColor(color)
      .rect(30, y, 5, 55)
      .fill();

    // Title & Value
    doc.fillColor('#1e293b')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(title, 45, y + 8);

    doc.fillColor(color)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(value, pageWidth - 150, y + 6);

    // Status
    doc.fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(status, pageWidth - 150, y + 22);

    // Formula (small)
    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica-Oblique')
      .text(`Rumus: ${formula}`, 45, y + 25);

    // Calculation (small)
    doc.fillColor('#6b7280')
      .fontSize(7)
      .font('Helvetica')
      .text(`Hitung: ${calculation}`, 45, y + 35);

    // Separator
    doc.moveTo(45, y + 48)
      .lineTo(pageWidth - 45, y + 48)
      .lineWidth(0.5)
      .stroke('#e5e7eb');

    return y + 60;
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

    doc.fontSize(14).text(icon, x + 8, y + 10);

    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(title, x + 30, y + 10);

    doc.fillColor('#475569')
      .fontSize(8)
      .font('Helvetica')
      .text(text, x + 30, y + 22, { width: width - 40 });
  }

  private drawRecommendationBox(
    x: number,
    y: number,
    width: number,
    height: number,
    priority: string,
    text: string
  ) {
    const { doc } = this;

    const bgColor = priority === 'HIGH' ? '#fee2e2' : priority === 'MEDIUM' ? '#fef3c7' : '#dcfce7';
    const priorityColor = priority === 'HIGH' ? '#dc2626' : priority === 'MEDIUM' ? '#d97706' : '#059669';

    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    doc.fillColor(priorityColor)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(`🔴 ${priority}`, x + 8, y + 10);

    doc.fillColor('#1e293b')
      .fontSize(8)
      .font('Helvetica')
      .text(text, x + 8, y + 22, { width: width - 20 });
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
        text: 'Periode ini belum ada penjualan. Perlu review strategi marketing & promosi.',
      });
    } else if (metrics.salesCount < 5) {
      insights.push({
        color: '#fee2e2',
        icon: '📉',
        title: 'PENJUALAN RENDAH',
        text: `Hanya ${metrics.salesCount} unit terjual. Perlu increase promosi dan aktivitas sales.`,
      });
    }

    if (metrics.inventoryTurnover < 20) {
      insights.push({
        color: '#fef3c7',
        icon: '📦',
        title: 'STOK TINGGI',
        text: `Inventory turnover ${metrics.inventoryTurnover}%. Stok belum berputar optimal.`,
      });
    }

    if (metrics.atv < 60) {
      insights.push({
        color: '#fee2e2',
        icon: '💡',
        title: 'HARGA PERLU DITINGKATKAN',
        text: `ATV ${metrics.atv}% dari rata-rata industri. Pertimbangkan strategi pricing.`,
      });
    }

    // Add default insight if empty
    if (insights.length === 0) {
      insights.push({
        color: '#dcfce7',
        icon: '✅',
        title: 'PERFORMA BAIK',
        text: `${metrics.salesCount} unit terjual dengan nilai Rp ${this.formatNumber(metrics.salesValue)}.`,
      });
    }

    return insights;
  }

  private generateRecommendations(metrics: any): Array<{
    priority: string;
    text: string;
  }> {
    const recommendations = [];

    if (metrics.salesCount === 0) {
      recommendations.push({
        priority: 'HIGH',
        text: 'TINGKATKAN AKTIVITAS MARKETING: Promo diskon khusus, bundle deals, follow up leads',
      });
    }

    if (metrics.inventoryTurnover < 20) {
      recommendations.push({
        priority: 'MEDIUM',
        text: 'EVALUASI MEREK KURANG LAKU: Clearance sale stok lama, promo khusus slow-moving',
      });
    }

    if (metrics.salesPerEmployee < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        text: 'TRAINING SALES STAFF: Training negosiasi, incentive program, coaching dari top performer',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        text: 'MONITOR METRICS HARIAN: Review dashboard untuk track performa dan identify trends',
      });
    }

    return recommendations;
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
