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
      margin: 0, // Zero margin for full-bleed header
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
    const margin = 30; // Standard content margin
    const contentWidth = pageWidth - margin * 2;
    const maxY = pageHeight - 50; // Max Y before footer

    // ==================== 1. FULL WIDTH HEADER (BLUE) ====================
    const headerHeight = 100;

    // Blue Background
    doc.fillColor('#1e40af') // Dark Blue
      .rect(0, 0, pageWidth, headerHeight)
      .fill();

    // Title (White, Centered)
    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(`"${config.title.toUpperCase()}"`, 0, 30, { width: pageWidth, align: 'center' });

    // Logo / Tenant Name (Below Title)
    // Placeholder for Logo if URL exists, otherwise text
    if (config.logoUrl) {
      // In a real scenario, we'd fetch the image buffer. For now, text fallback.
      // doc.image(config.logoUrl...)
    }

    // Tenant Name Badge (Darker Blue/Black bg with Red/Warning accent style from image?)
    // Image shows: "PRIMA MOBIL" logo. We simulate with styled text box.
    const logoBoxWidth = 140;
    const logoBoxHeight = 30;
    const logoX = (pageWidth - logoBoxWidth) / 2;
    const logoY = 60;

    // Simulate Logo Box
    doc.fillColor('#0f172a').rect(logoX, logoY, logoBoxWidth, logoBoxHeight).fill(); // Black bg
    doc.fillColor('#ef4444').rect(logoX, logoY + 26, logoBoxWidth, 4).fill(); // Red underline stripe
    doc.fillColor('#ffffff')
      .fontSize(14)
      .font('Helvetica-BoldOblique') // Italic bold for sporty look
      .text(config.tenantName.toUpperCase(), logoX, logoY + 6, { width: logoBoxWidth, align: 'center' });


    // ==================== 2. METRICS ROW (4 Colored Cards) ====================
    let currentY = headerHeight + 30;
    const cardGap = 10;
    const cardWidth = (contentWidth - (cardGap * 3)) / 4;
    const cardHeight = 70;

    const metricColors = ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c']; // Blue, Green, Purple, Orange

    config.metrics.slice(0, 4).forEach((metric, idx) => {
      const x = margin + idx * (cardWidth + cardGap);
      const color = metricColors[idx % metricColors.length];

      // Card Bg
      doc.fillColor(color).roundedRect(x, currentY, cardWidth, cardHeight, 5).fill();

      // Label (Small White)
      doc.fillColor('#ffffff')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(metric.label.toUpperCase(), x + 8, currentY + 8, { width: cardWidth - 16 });

      // Value (Big White)
      doc.fontSize(16)
        .text(metric.value, x + 8, currentY + 25);

      // Unit/Subtitle (Small)
      if (metric.unit) {
        doc.fontSize(8).text(metric.unit, x + 8, currentY + 48);
      }
    });

    currentY += cardHeight + 30;


    // ==================== 3. FORMULAS TABLE (Rumusan Perhitungan) ====================
    doc.fillColor('#1e293b') // Dark slate
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN:', margin, currentY);

    currentY += 15;

    // Table Header
    const col1W = contentWidth * 0.75;
    const col2W = contentWidth * 0.25;
    const rowHeight = 45; // Taller rows for formulas

    doc.fillColor('#e2e8f0') // Light gray header
      .rect(margin, currentY, contentWidth, 20)
      .fill();

    doc.fillColor('#475569') // Header Text
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('RUMUSAN PER METRIK', margin + 5, currentY + 6)
      .text('HASIL', margin + col1W, currentY + 6, { width: col2W - 5, align: 'right' });

    currentY += 20;

    // Table Rows (Metrics with formulas)
    config.metrics.forEach((metric, idx) => {
      if (!metric.formula) return; // Skip if no formula

      // Alternating row bg (Light Yellowish like image)
      doc.fillColor('#fefce8') // Very light yellow
        .rect(margin, currentY, contentWidth, rowHeight)
        .fill();

      // Metric Name
      doc.fillColor('#1e293b')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(metric.label, margin + 5, currentY + 5);

      // Formula Text (Gray)
      doc.fillColor('#64748b')
        .fontSize(8)
        .font('Helvetica')
        .text(`R: ${metric.formula}`, margin + 5, currentY + 18)
        .text(`H: -`, margin + 5, currentY + 30); // Placeholder for "Hitungan" if needed

      // Result Value (Red/Bold on right)
      doc.fillColor('#dc2626') // Reddish text
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(metric.value, margin + col1W, currentY + 15, { width: col2W - 10, align: 'right' });

      currentY += rowHeight + 2;
    });

    currentY += 30;


    // ==================== 4. VISUALIZATION (Pie Chart) ====================
    if (config.showChart && config.chartData && config.chartData.length > 0) {
      if (currentY + 150 > maxY) { doc.addPage(); currentY = margin; }

      doc.fillColor('#1e40af')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`VISUALISASI PERFORMA "${config.title}"`, margin, currentY);

      currentY += 20;

      // Draw Pie Chart Context
      const chartCenterY = currentY + 60;
      const chartCenterX = pageWidth - margin - 80; // Right side
      const radius = 50;

      this.drawPieChart(doc, chartCenterX, chartCenterY, radius, config.chartData);

      // List of indicators on the left (pointing to chart)
      let indicatorY = currentY;
      config.chartData.forEach((item) => {
        // Colored Box
        doc.fillColor(item.color).rect(margin, indicatorY, 100, 20).fill();
        // Label
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text(item.label, margin + 5, indicatorY + 6, { width: 90, align: 'center' });

        // Arrow line
        doc.lineWidth(1).strokeColor('#94a3b8')
          .moveTo(margin + 105, indicatorY + 10)
          .lineTo(chartCenterX - radius - 10, chartCenterY) // All point to center-left of pie
          .stroke();

        indicatorY += 30;
      });

      currentY = Math.max(currentY + 140, indicatorY + 20);
    }


    // ==================== 5. ANALYSIS & FOOTER ====================
    // Analysis
    if (config.analysis && config.analysis.length > 0) {
      doc.fillColor('#dc2626') // Red Title
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Analisa Showroom: "${config.tenantName}"`, margin, currentY);

      currentY += 15;
      config.analysis.forEach(line => {
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(line, margin, currentY);
        currentY += 12;
      });
    }

    // Footer (Fixed position)
    const footerY = pageHeight - 30;
    doc.fontSize(8).fillColor('#94a3b8')
      .text(`Generated by ${config.tenantName} | ${this.formatDate(config.date)}`, margin, footerY, { align: 'center', width: contentWidth });
  }

  // Helper: Draw Pie Chart
  private drawPieChart(doc: PDFKit.PDFDocument, cx: number, cy: number, radius: number, data: { value: string, color: string }[]) {
    // Prepare data: parse values to numbers
    const numericData = data.map(d => ({
      val: parseFloat(d.value.replace(/[^0-9.-]+/g, '')) || 0,
      color: d.color
    }));
    const total = numericData.reduce((sum, d) => sum + d.val, 0);

    if (total === 0) {
      // Draw empty circle
      doc.lineWidth(2).strokeColor('#cbd5e1').circle(cx, cy, radius).stroke();
      doc.fillColor('#94a3b8').fontSize(8).text('No Data', cx - 20, cy - 4);
      return;
    }

    let startAngle = 0;
    numericData.forEach(slice => {
      if (slice.val <= 0) return;
      const sliceAngle = (slice.val / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      // Draw Slice (Arc calculation approx)
      doc.save();
      doc.fillColor(slice.color);
      doc.moveTo(cx, cy); // Center
      // Note: PDFKit arc uses radians. 0 is right (3 o'clock).
      (doc as any).arc(cx, cy, radius, startAngle, endAngle);
      doc.lineTo(cx, cy);
      doc.fill();
      doc.restore();

      startAngle = endAngle;
    });

    // White hole in middle for Donut Chart look (optional, looks modern)
    doc.fillColor('#ffffff').circle(cx, cy, radius * 0.5).fill();
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
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

