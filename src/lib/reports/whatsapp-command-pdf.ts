/**
 * Unified Professional PDF Generator for WhatsApp AI Commands
 * Creates professional 2-page PDFs with formulas, charts, and real data
 */

import PDFDocument from 'pdfkit';

interface ReportConfig {
  title: string;
  subtitle: string;
  tenantName: string;
  date: Date;
  metrics: Metric[];
  showChart?: boolean;
  chartData?: { label: string; value: number; color: string }[];
  formula?: string;
  calculation?: string;
}

interface Metric {
  label: string;
  value: string;
  unit?: string;
  color: string;
  formula?: string;
  calculation?: string;
}

export class WhatsAppCommandPDF {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];

  constructor() {
    this.doc = new PDFDocument({
      size: 'LETTER', // Changed from A4 to LETTER for better management review
      margin: 20,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(config: ReportConfig): Promise<Buffer> {
    console.log('[WhatsAppCommandPDF] 🚀 Generating:', config.title);

    // PAGE 1: Executive Dashboard with Chart + Formulas Below
    this.doc.addPage();
    this.generatePage1(config);

    // PAGE 2: Key Insights Only
    this.doc.addPage();
    this.generatePage2(config);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[WhatsAppCommandPDF] ✅ PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generatePage1(config: ReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Maximum Y position before footer (prevent overflow)
    const maxY = pageHeight - 40;

    // Header - Increased height to prevent date cutoff
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, 55).fill();

    doc.fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(config.title.toUpperCase(), 20, 15);

    doc.fontSize(12)
      .font('Helvetica')
      .text(config.tenantName.toUpperCase(), 20, 35);

    // Date positioned with more space to prevent cutoff
    doc.fontSize(8)
      .fillColor('#93c5fd')
      .text(`Data: ${this.formatDate(config.date)}`, pageWidth - 25, 20, { align: 'right' });
    doc.text(`Cetak: ${this.formatDate(new Date())}`, pageWidth - 25, 32, { align: 'right' });

    // Metrics Grid - Top row (6 cards in 2x3 grid)
    const cardWidth = (pageWidth - 40) / 3 - 8;
    const cardHeight = 70; // Reduced from 75 to save space
    const startY = 63; // Adjusted for new header height
    const gap = 8;

    config.metrics.slice(0, 6).forEach((metric, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 20 + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
    });

    let y = startY + 2 * (cardHeight + gap) + 8;

    // Chart section - ONLY if space allows and showChart is true
    if (y + 137 < maxY && config.showChart) {
      doc.fontSize(11)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('VISUALISASI DATA', 20, y);

      y += 22;

      // Draw donut chart on left (even with 0/empty data)
      const chartData = config.chartData && config.chartData.length > 0 ? config.chartData : [];
      this.drawDonutChart(20, y, 100, chartData);

      // Draw legend on right or "No Data" message
      const legendX = 130;
      let legendY = y;

      if (chartData.length > 0) {
        chartData.forEach((item) => {
          doc.fillColor(item.color).rect(legendX, legendY, 10, 10).fill();

          doc.fillColor('#1e293b')
            .fontSize(9)
            .font('Helvetica')
            .text(`${item.label}: ${item.value}`, legendX + 15, legendY + 8);

          legendY += 18;
        });
      } else {
        doc.fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text('Belum ada data', legendX, legendY + 8);
      }

      y += 115;
    }

    // Footer Page 1
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 1 of 2 | Laporan Profesional', pageWidth / 2, pageHeight - 14, { align: 'center' });
  }

  private generatePage2(config: ReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Maximum Y position before footer (prevent overflow)
    const maxY = pageHeight - 40; // Leave space for footer

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

    // Global formula/calculation if provided
    if (y + 47 < maxY && (config.formula || config.calculation)) {
      doc.fillColor('#f0fdf4')
        .rect(20, y, pageWidth - 40, 40)
        .fill();

      doc.fillColor('#16a34a')
        .rect(20, y, 4, 40)
        .fill();

      doc.fillColor('#1e293b')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('RUMUS PERHITUNGAN GLOBAL', 30, y + 6);

      if (config.formula) {
        doc.fillColor('#64748b')
          .fontSize(7)
          .font('Helvetica-Oblique')
          .text(`Rumus: ${config.formula}`, 30, y + 18);
      }

      if (config.calculation) {
        doc.fillColor('#6b7280')
          .fontSize(7)
          .font('Helvetica')
          .text(`Perhitungan: ${config.calculation}`, 30, y + 28);
      }

      y += 47;
    }

    // Metric formulas - show ONLY first 2 (reduced from 3)
    const metricsWithFormulas = config.metrics.filter(m => m.formula || m.calculation).slice(0, 2);

    if (y + 12 + (metricsWithFormulas.length * 43) < maxY && metricsWithFormulas.length > 0) {
      doc.fontSize(10)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('RUMUSAN PER METRIK', 20, y);

      y += 12;

      metricsWithFormulas.forEach((metric, idx) => {
        // Alternating background colors
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        doc.fillColor(bgColor)
          .rect(20, y, pageWidth - 40, 38)
          .fill();

        doc.fillColor(metric.color)
          .rect(20, y, 4, 38)
          .fill();

        doc.fillColor('#1e293b')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(metric.label, 30, y + 5);

        doc.fillColor(metric.color)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(metric.value, pageWidth - 120, y + 5);

        if (metric.formula) {
          doc.fillColor('#94a3b8')
            .fontSize(6)
            .font('Helvetica-Oblique')
            .text(`R: ${metric.formula}`, 30, y + 17);
        }

        if (metric.calculation) {
          doc.fillColor('#6b7280')
            .fontSize(6)
            .font('Helvetica')
            .text(`H: ${metric.calculation}`, 30, y + 26);
        }

        y += 43;
      });
    }

    // Single insight box - ONLY if space allows
    if (y + 50 < maxY && config.metrics.length > 0) {
      y += 8;

      const topMetric = config.metrics[0];
      this.drawInsightBox(20, y, pageWidth - 40, 35, '#dcfce7', '✅', 'INSIGHT UTAMA',
        `${topMetric.label}: ${topMetric.value} ${topMetric.unit || ''}`);

      y += 42;
    }

    // Footer
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 2 of 2 | Laporan Profesional', pageWidth / 2, pageHeight - 14, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(6)
      .text(`Generated by AutoLumiKu | ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  }

  private drawMetricCard(x: number, y: number, width: number, height: number, metric: Metric) {
    const { doc } = this;

    doc.fillColor(metric.color).rect(x, y, width, height).fill();

    doc.fillColor('#ffffff')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(metric.label.toUpperCase(), x + 5, y + 8);

    doc.fontSize(18)
      .font('Helvetica-Bold')
      .text(metric.value, x + 5, y + 22);

    if (metric.unit) {
      doc.fontSize(8)
        .font('Helvetica')
        .text(metric.unit, x + 5, y + 45);
    }
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

  private drawInsightBox(x: number, y: number, width: number, height: number, bgColor: string, icon: string, title: string, text: string) {
    const { doc } = this;

    doc.fillColor(bgColor).rect(x, y, width, height).fill();

    doc.fontSize(11).text(icon, x + 5, y + 10);

    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(title, x + 20, y + 10);

    doc.fillColor('#475569')
      .fontSize(8)
      .font('Helvetica')
      .text(text, x + 20, y + 22, { width: width - 30 });
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

  private formatCurrency(num: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }
}

// Helper function to create formatted currency
export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Helper function to format number
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}
