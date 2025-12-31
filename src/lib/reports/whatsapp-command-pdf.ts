/**
 * Unified Professional PDF Generator for WhatsApp AI Commands
 * Creates professional 1-page PDFs with formulas, charts, and real data
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
    console.log('[WhatsAppCommandPDF] 🚀 Generating 1-page PDF:', config.title);

    // SINGLE PAGE: Executive Dashboard with all sections
    this.doc.addPage();
    this.generateSinglePage(config);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[WhatsAppCommandPDF] ✅ 1-page PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generateSinglePage(config: ReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Maximum Y position before footer
    const maxY = pageHeight - 50;

    // Header - Improved layout with more space
    const headerHeight = 55;
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, headerHeight).fill();

    // Title (top line)
    doc.fillColor('#ffffff')
      .fontSize(15)
      .font('Helvetica-Bold')
      .text(config.title.toUpperCase(), 20, 10, { width: pageWidth - 120 });

    // Tenant name (second line) - more space to prevent cutoff
    doc.fontSize(10)
      .font('Helvetica')
      .text(config.tenantName.toUpperCase(), 20, 28, { width: pageWidth - 120 });

    // Date (right side) - positioned to not overlap with tenant name
    doc.fontSize(7)
      .fillColor('#93c5fd')
      .text(`Data: ${this.formatDate(config.date)}`, pageWidth - 25, 15, { align: 'right' });
    doc.text(`Cetak: ${this.formatDate(new Date())}`, pageWidth - 25, 25, { align: 'right' });

    // Metrics Grid - Compact (6 cards in 2x3 grid)
    const cardWidth = (pageWidth - 40) / 3 - 6;
    const cardHeight = 55; // Reduced from 70
    const startY = headerHeight + 8; // Position below header with gap
    const gap = 6;

    config.metrics.slice(0, 6).forEach((metric, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 20 + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
    });

    let y = startY + 2 * (cardHeight + gap) + 6;

    // Chart section - Compact (if space allows)
    if (y + 100 < maxY && config.showChart) {
      doc.fontSize(10)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('VISUALISASI DATA', 20, y);

      y += 18;

      // Draw donut chart
      const chartData = config.chartData && config.chartData.length > 0 ? config.chartData : [];
      this.drawDonutChart(20, y, 70, chartData); // Reduced size from 100 to 70

      // Draw legend
      const legendX = 100;
      let legendY = y;

      if (chartData.length > 0) {
        chartData.forEach((item) => {
          doc.fillColor(item.color).rect(legendX, legendY, 8, 8).fill();

          doc.fillColor('#1e293b')
            .fontSize(8)
            .font('Helvetica')
            .text(`${item.label}: ${item.value}`, legendX + 12, legendY + 7);

          legendY += 14;
        });
      } else {
        doc.fillColor('#64748b')
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text('Belum ada data', legendX, legendY + 7);
      }

      y += 85;
    }

    // Formulas Section - Compact
    if (y + 80 < maxY) {
      doc.fontSize(9)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('RUMUSAN PERHITUNGAN', 20, y);

      y += 14;

      // Global formula/calculation
      if (config.formula || config.calculation) {
        doc.fillColor('#f0fdf4')
          .rect(20, y, pageWidth - 40, 30)
          .fill();

        doc.fillColor('#16a34a')
          .rect(20, y, 4, 30)
          .fill();

        doc.fillColor('#1e293b')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('RUMUS GLOBAL', 30, y + 5);

        if (config.formula) {
          doc.fillColor('#64748b')
            .fontSize(6)
            .font('Helvetica-Oblique')
            .text(`R: ${config.formula}`, 30, y + 14);
        }

        if (config.calculation) {
          doc.fillColor('#6b7280')
            .fontSize(6)
            .font('Helvetica')
            .text(`H: ${config.calculation}`, 30, y + 22);
        }

        y += 35;
      }

      // Metric formulas - Show first 2 only
      const metricsWithFormulas = config.metrics.filter(m => m.formula || m.calculation).slice(0, 2);

      metricsWithFormulas.forEach((metric, idx) => {
        if (y + 35 > maxY) return;

        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        doc.fillColor(bgColor)
          .rect(20, y, pageWidth - 40, 32)
          .fill();

        doc.fillColor(metric.color)
          .rect(20, y, 4, 32)
          .fill();

        doc.fillColor('#1e293b')
          .fontSize(7)
          .font('Helvetica-Bold')
          .text(metric.label, 30, y + 4);

        if (metric.formula) {
          doc.fillColor('#94a3b8')
            .fontSize(6)
            .font('Helvetica-Oblique')
            .text(`R: ${metric.formula}`, 30, y + 13);
        }

        if (metric.calculation) {
          doc.fillColor('#6b7280')
            .fontSize(6)
            .font('Helvetica')
            .text(`H: ${metric.calculation}`, 30, y + 22);
        }

        y += 35;
      });
    }

    // Footer - "Generated by {tenant}" NOT AutoLumiKu
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 25, pageWidth - 40, 20)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text(`Generated by ${config.tenantName} | ${new Date().toLocaleString('id-ID')} | Data: Real-time from database`,
        pageWidth / 2, pageHeight - 18, { align: 'center' });
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
