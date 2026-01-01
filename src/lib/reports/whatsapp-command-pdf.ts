/**
 * Unified Professional PDF Generator for WhatsApp AI Commands
 * Creates professional 1-page PDFs with formulas, charts, and real data
 */

import PDFDocument from 'pdfkit';

interface ReportConfig {
  title: string;
  subtitle: string;
  tenantName: string;
  logoUrl?: string;
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
    // Header - White Theme (consistent with Sales Report)
    const headerHeight = 85;

    // 1. Title (Top)
    doc.fillColor('#1e40af') // Blue title
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(config.title.toUpperCase(), 25, 15, { width: pageWidth - 50, align: 'center' });

    // 2. Logo or Tenant Badge (Below Title, Centered)
    const logoY = 40;
    if (config.logoUrl) {
      try {
        // Center the logo
        const logoWidth = 80;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.image(config.logoUrl, logoX, logoY, { fit: [80, 30], align: 'center' });
      } catch (error) {
        console.error('[WhatsAppCommandPDF] ❌ Failed to load logo:', error);
        // Fallback badge
        this.drawTenantBadge(doc, config.tenantName, pageWidth, logoY);
      }
    } else {
      this.drawTenantBadge(doc, config.tenantName, pageWidth, logoY);
    }

    // 3. Subtitle (Below Logo)
    doc.fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(config.subtitle.toUpperCase(), 25, logoY + 35, { width: pageWidth - 50, align: 'center' });

    // Date (Top Right Corner - Small)
    doc.fontSize(7)
      .fillColor('#94a3b8')
      .text(`Date: ${this.formatDate(config.date)}`, pageWidth - 80, 15, { width: 60, align: 'right' });


    // Metrics Grid - Clean Design
    const cardWidth = (pageWidth - 40) / 2 - 10; // 2 cols
    const cardHeight = 60;
    const startY = headerHeight + 20;
    const gap = 12;

    config.metrics.slice(0, 4).forEach((metric, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 20 + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
    });

    let y = startY + 2 * (cardHeight + gap) + 15;

    // Chart section - Clean
    if (y + 120 < maxY && config.showChart) {
      doc.fontSize(10)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('VISUALISASI DATA', 20, y);

      // Line separator
      doc.moveTo(20, y + 14).lineTo(pageWidth - 20, y + 14).strokeColor('#e2e8f0').lineWidth(1).stroke();

      y += 25;

      // Draw donut chart
      const chartData = config.chartData && config.chartData.length > 0 ? config.chartData : [];
      this.drawDonutChart(20, y, 90, chartData); // Slightly larger donut

      // Draw legend to the right of chart
      const legendX = 130;
      let legendY = y + 10;

      if (chartData.length > 0) {
        chartData.forEach((item) => {
          doc.fillColor(item.color).rect(legendX, legendY, 10, 10).fill();

          doc.fillColor('#1e293b')
            .fontSize(9)
            .font('Helvetica')
            .text(`${item.label}: ${item.value}`, legendX + 16, legendY);

          legendY += 16;
        });
      } else {
        doc.fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text('Belum ada data visualisasi', legendX, legendY);
      }
      y += 100; // Space for chart
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

  private drawTenantBadge(doc: PDFKit.PDFDocument, name: string, pageWidth: number, y: number) {
    const badgeWidth = 120;
    const badgeHeight = 22;
    const x = (pageWidth - badgeWidth) / 2;

    doc.fillColor('#e2e8f0')
      .roundedRect(x, y, badgeWidth, badgeHeight, 11)
      .fill();

    doc.fillColor('#475569')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(name.toUpperCase(), x, y + 6, {
        width: badgeWidth,
        align: 'center',
      });
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
