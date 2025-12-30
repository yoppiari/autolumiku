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
      size: 'A4',
      margin: 20,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(config: ReportConfig): Promise<Buffer> {
    console.log('[WhatsAppCommandPDF] 🚀 Generating:', config.title);

    // PAGE 1: Executive Dashboard
    this.doc.addPage();
    this.generatePage1(config);

    // PAGE 2: Detailed Analysis
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

    // Header
    doc.fillColor('#1e40af').rect(0, 0, pageWidth, 50).fill();

    doc.fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(config.title.toUpperCase(), 20, 15);

    doc.fontSize(12)
      .font('Helvetica')
      .text(config.tenantName.toUpperCase(), 20, 32);

    doc.fontSize(8)
      .fillColor('#93c5fd')
      .text(this.formatDate(config.date), pageWidth - 20, 20, { align: 'right' });
    doc.text(`Dicetak: ${this.formatDate(new Date())}`, pageWidth - 20, 30, { align: 'right' });

    // Metrics Grid - Top row (3 cards)
    const cardWidth = (pageWidth - 40) / 3 - 8;
    const cardHeight = 80;
    const startY = 58;
    const gap = 8;

    config.metrics.slice(0, 6).forEach((metric, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 20 + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
    });

    // Chart section
    if (config.showChart && config.chartData && config.chartData.length > 0) {
      let y = startY + 2 * (cardHeight + gap) + 15;

      doc.fontSize(11)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('VISUALISASI DATA', 20, y);

      y += 25;

      // Draw donut chart on left
      this.drawDonutChart(20, y, 120, config.chartData);

      // Draw legend on right
      const legendX = 150;
      let legendY = y;
      config.chartData.forEach((item) => {
        doc.fillColor(item.color).rect(legendX, legendY, 10, 10).fill();

        doc.fillColor('#1e293b')
          .fontSize(9)
          .font('Helvetica')
          .text(`${item.label}: ${item.value}`, legendX + 15, legendY + 8);

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
      .text('Page 1 of 2 | Professional Report', pageWidth / 2, pageHeight - 14, { align: 'center' });
  }

  private generatePage2(config: ReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Header
    doc.fillColor('#1e40af')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('ANALISIS DETAIL & RUMUSAN PERHITUNGAN', 20, 20);

    doc.moveTo(20, 35)
      .lineTo(pageWidth - 20, 35)
      .lineWidth(0.5)
      .stroke('#e5e7eb');

    let y = 50;

    // Show formula and calculation if provided
    if (config.formula || config.calculation) {
      doc.fillColor('#f9fafb')
        .rect(20, y, pageWidth - 40, 60)
        .fill();

      doc.fillColor('#1e293b')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('RUMUS PERHITUNGAN', 30, y + 10);

      if (config.formula) {
        doc.fillColor('#64748b')
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text(`Rumus: ${config.formula}`, 30, y + 25);
      }

      if (config.calculation) {
        doc.fillColor('#6b7280')
          .fontSize(8)
          .font('Helvetica')
          .text(`Perhitungan: ${config.calculation}`, 30, y + 40);
      }

      y += 70;
    }

    // Detailed metrics with formulas
    config.metrics.forEach((metric) => {
      if (metric.formula || metric.calculation) {
        doc.fillColor('#f9fafb')
          .rect(20, y, pageWidth - 40, 50)
          .fill();

        doc.fillColor(metric.color)
          .rect(20, y, 4, 50)
          .fill();

        doc.fillColor('#1e293b')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(metric.label, 30, y + 8);

        doc.fillColor(metric.color)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text(metric.value, pageWidth - 120, y + 8);

        if (metric.formula) {
          doc.fillColor('#94a3b8')
            .fontSize(6)
            .font('Helvetica-Oblique')
            .text(`Rumus: ${metric.formula}`, 30, y + 22);
        }

        if (metric.calculation) {
          doc.fillColor('#6b7280')
            .fontSize(6)
            .font('Helvetica')
            .text(`Hitung: ${metric.calculation}`, 30, y + 32);
        }

        y += 55;
      }
    });

    // Insights
    if (config.metrics.length > 0) {
      y += 10;

      doc.fontSize(11)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('KEY INSIGHTS', 20, y);

      y += 15;

      const topMetric = config.metrics[0];
      this.drawInsightBox(20, y, pageWidth - 40, 40, '#dcfce7', '✅', 'PERFORMA UTAMA',
        `${topMetric.label}: ${topMetric.value} ${topMetric.unit || ''}`);

      y += 50;

      if (config.metrics.length > 1) {
        const secondMetric = config.metrics[1];
        this.drawInsightBox(20, y, pageWidth - 40, 40, '#dbeafe', '📊', 'METRIK KEDUA',
          `${secondMetric.label}: ${secondMetric.value} ${secondMetric.unit || ''}`);
      }
    }

    // Footer
    doc.fillColor('#f1f5f9')
      .rect(20, pageHeight - 20, pageWidth - 40, 15)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text('Page 2 of 2 | Professional Report', pageWidth / 2, pageHeight - 14, { align: 'center' });

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
      .text(metric.label.toUpperCase(), x + 5, y + 10);

    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text(metric.value, x + 5, y + 25);

    if (metric.unit) {
      doc.fontSize(8)
        .font('Helvetica')
        .text(metric.unit, x + 5, y + 50);
    }

    if (metric.formula) {
      doc.fontSize(6)
        .font('Helvetica-Oblique')
        .fillColor('rgba(255,255,255,0.9)')
        .text('Rumus tersedia →', x + 5, y + 65);
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

    doc.fontSize(12).text(icon, x + 5, y + 12);

    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(title, x + 22, y + 12);

    doc.fillColor('#475569')
      .fontSize(8)
      .font('Helvetica')
      .text(text, x + 22, y + 26, { width: width - 30 });
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
