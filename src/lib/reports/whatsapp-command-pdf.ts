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
  chartData?: { label: string; value: string; color: string }[];
  analysis?: string[];
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
      size: 'LETTER',
      margin: 20,
      bufferPages: true,
      autoFirstPage: false,
    });

    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  async generate(config: ReportConfig): Promise<Buffer> {
    console.log('[WhatsAppCommandPDF] 🚀 Generating professional 1-page PDF:', config.title);

    this.doc.addPage();
    this.generateSinglePage(config);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    return pdfBuffer;
  }

  private generateSinglePage(config: ReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 25;
    const contentWidth = pageWidth - margin * 2;

    // Maximum Y position before footer
    const maxY = pageHeight - 50;

    // 1. Header - Premium White Theme
    const headerHeight = 85;

    // Title (Top)
    doc.fillColor('#1e40af')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(config.title.toUpperCase(), margin, 15, { width: contentWidth, align: 'center' });

    // Logo or Tenant Badge (Below Title, Centered)
    const logoY = 40;
    if (config.logoUrl) {
      try {
        const logoWidth = 80;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.image(config.logoUrl, logoX, logoY, { fit: [80, 30], align: 'center' });
      } catch (error) {
        this.drawTenantBadge(doc, config.tenantName, pageWidth, logoY);
      }
    } else {
      this.drawTenantBadge(doc, config.tenantName, pageWidth, logoY);
    }

    // Subtitle (Below Logo)
    doc.fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(config.subtitle.toUpperCase(), margin, logoY + 35, { width: contentWidth, align: 'center' });

    // Date (Right Side)
    doc.fontSize(7)
      .fillColor('#94a3b8')
      .text(`Date: ${this.formatDate(config.date)}`, pageWidth - 100, 15, { width: 75, align: 'right' });

    // 2. Metrics Grid
    const cardWidth = (contentWidth - 12) / 2;
    const cardHeight = 60;
    const startY = headerHeight + 20;
    const gap = 12;

    config.metrics.slice(0, 4).forEach((metric, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = margin + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);
      this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
    });

    let currentY = startY + 2 * (cardHeight + gap) + 15;

    // 3. Visualization Section (Horizontal Bars)
    if (config.showChart && config.chartData && config.chartData.length > 0) {
      doc.fillColor('#1e40af')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('VISUALISASI PERFORMA', margin, currentY);

      currentY += 15;

      const chartItems = config.chartData.slice(0, 5);
      const barH = 28;
      const barGap = 15;

      chartItems.forEach((item) => {
        // Label above bar
        doc.fillColor('#475569')
          .fontSize(8)
          .font('Helvetica')
          .text(item.label, margin, currentY);

        currentY += 11;

        // Bar background
        doc.fillColor('#f8fafc')
          .roundedRect(margin, currentY, contentWidth, barH, 3)
          .fill();

        // Left stripe
        doc.fillColor(item.color)
          .roundedRect(margin, currentY, 5, barH, 3)
          .fill();

        // Value text
        doc.fillColor('#1e293b')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(item.value, margin + 15, currentY + 8);

        currentY += barH + barGap;
      });
    }

    // 4. Analysis Section
    if (config.analysis && config.analysis.length > 0) {
      if (currentY + 60 > maxY) {
        doc.addPage();
        currentY = margin;
      }

      doc.fillColor('#1e293b')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Analisa Data:', margin, currentY);

      currentY += 16;

      config.analysis.forEach((item) => {
        const cleanItem = item.replace(/^[•\-\*><]+\s*/, '').trim();
        const textHeight = doc.heightOfString(`- ${cleanItem}`, { width: contentWidth });

        if (currentY + textHeight > maxY) {
          doc.addPage();
          currentY = margin;
        }

        doc.fillColor('#000000')
          .fontSize(9)
          .font('Helvetica')
          .text(`- ${cleanItem}`, margin, currentY, { width: contentWidth });

        currentY += textHeight + 4;
      });
    }

    // 5. Formulas Section (If present)
    if (config.formula || config.calculation) {
      if (currentY + 40 > maxY) {
        doc.addPage();
        currentY = margin;
      }

      doc.fillColor('#1e40af')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('RUMUSAN PERHITUNGAN', margin, currentY);

      currentY += 14;

      doc.fillColor('#f8fafc')
        .rect(margin, currentY, contentWidth, 30)
        .fill();

      doc.fillColor('#1e293b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(config.formula ? `RUMUS: ${config.formula}` : 'DETAIL PERHITUNGAN', margin + 8, currentY + 6);

      if (config.calculation) {
        doc.fillColor('#64748b')
          .fontSize(7)
          .font('Helvetica')
          .text(`HASIL: ${config.calculation}`, margin + 8, currentY + 16);
      }
    }

    // Footer
    const footerY = pageHeight - 25;
    doc.fillColor('#f1f5f9').rect(margin, footerY, contentWidth, 20).fill();
    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text(`Generated by ${config.tenantName} | Real-time Database | ${new Date().toLocaleString('id-ID')}`,
        margin, footerY + 6, { width: contentWidth, align: 'center' });
  }

  private drawMetricCard(x: number, y: number, width: number, height: number, metric: Metric) {
    const { doc } = this;
    doc.fillColor(metric.color).rect(x, y, width, height).fill();
    doc.fillColor('#ffffff')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(metric.label.toUpperCase(), x + 8, y + 10);
    doc.fontSize(18)
      .font('Helvetica-Bold')
      .text(metric.value, x + 8, y + 24);
    if (metric.unit) {
      doc.fontSize(8)
        .font('Helvetica')
        .text(metric.unit, x + 8, y + 46);
    }
  }

  private drawTenantBadge(doc: PDFKit.PDFDocument, name: string, pageWidth: number, y: number) {
    const badgeWidth = 120;
    const badgeHeight = 22;
    const x = (pageWidth - badgeWidth) / 2;
    doc.fillColor('#e2e8f0').roundedRect(x, y, badgeWidth, badgeHeight, 11).fill();
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text(name.toUpperCase(), x, y + 6, { width: badgeWidth, align: 'center' });
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

