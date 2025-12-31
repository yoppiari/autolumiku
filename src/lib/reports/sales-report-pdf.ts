/**
 * Sales Report PDF Generator - Professional Draft Format
 * Creates 1-page PDF with metrics, formulas, chart, and showroom analysis
 * Based on the new draft design format
 */

import PDFDocument from 'pdfkit';

interface SalesReportConfig {
  tenantName: string;
  date: Date;
  metrics: {
    totalPenjualan: number;
    totalRevenue: number;
    rataRataHarga: number;
    topSalesStaff: string | null;
  };
  chartData?: { label: string; value: number; percentage: number; color: string }[];
  showroomInsights?: string[];
}

interface FormulaItem {
  name: string;
  formula: string;
  calculation: string;
  result: string | number;
}

export class SalesReportPDF {
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

  async generate(config: SalesReportConfig): Promise<Buffer> {
    console.log('[SalesReportPDF] 🚀 Generating Sales Report PDF');

    this.doc.addPage();
    this.generatePage(config);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[SalesReportPDF] ✅ PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private generatePage(config: SalesReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let y = 0;

    // ==================== HEADER ====================
    const headerHeight = 50;
    
    // Blue header background
    doc.fillColor('#1e3a8a').rect(0, 0, pageWidth, headerHeight).fill();
    
    // "SALES REPORT" title
    doc.fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('SALES REPORT', 0, 15, { 
        align: 'center', 
        width: pageWidth 
      });
    
    // Tenant name badge (pink/red gradient look)
    const badgeText = config.tenantName.toUpperCase();
    const badgeWidth = doc.widthOfString(badgeText, { font: 'Helvetica-Bold', size: 8 }) + 16;
    const badgeX = (pageWidth - badgeWidth) / 2;
    const badgeY = 35;
    
    // Badge background
    doc.fillColor('#dc2626')
      .roundedRect(badgeX, badgeY, badgeWidth, 14, 3)
      .fill();
    
    doc.fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(badgeText, badgeX + 8, badgeY + 3);

    y = headerHeight + 5;

    // ==================== METRIC CARDS ====================
    const cardCount = 4;
    const cardGap = 8;
    const cardWidth = (contentWidth - (cardGap * (cardCount - 1))) / cardCount;
    const cardHeight = 45;
    
    const metricColors = ['#1e40af', '#16a34a', '#a855f7', '#f97316'];
    const metricLabels = ['TOTAL PENJUALAN', 'TOTAL REVENUE', 'RATA-RATA HARGA', 'TOP SALES STAFF'];
    const metricValues = [
      config.metrics.totalPenjualan.toString(),
      this.formatCurrency(config.metrics.totalRevenue),
      this.formatCurrency(config.metrics.rataRataHarga),
      config.metrics.topSalesStaff || 'N/A'
    ];
    const metricUnits = ['Unit', '', '', ''];

    for (let i = 0; i < cardCount; i++) {
      const x = margin + i * (cardWidth + cardGap);
      
      // Card background
      doc.fillColor(metricColors[i])
        .rect(x, y, cardWidth, cardHeight)
        .fill();
      
      // Label
      doc.fillColor('#ffffff')
        .fontSize(6)
        .font('Helvetica-Bold')
        .text(metricLabels[i], x + 5, y + 5, { width: cardWidth - 10 });
      
      // Value
      doc.fillColor('#ffffff')
        .fontSize(i === 3 ? 10 : 14) // Smaller font for staff name
        .font('Helvetica-Bold')
        .text(metricValues[i], x + 5, y + 18, { width: cardWidth - 10 });
      
      // Unit
      if (metricUnits[i]) {
        doc.fillColor('#ffffff')
          .fontSize(7)
          .font('Helvetica')
          .text(metricUnits[i], x + 5, y + 35, { width: cardWidth - 10 });
      }
    }

    y += cardHeight + 15;

    // ==================== RUMUSAN PERHITUNGAN SECTION ====================
    doc.fillColor('#1e293b')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN:', margin, y);
    
    y += 18;

    // Formula table header
    doc.fillColor('#f1f5f9')
      .rect(margin, y, contentWidth, 20)
      .fill();
    
    doc.fillColor('#1e293b')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('RUMUSAN PER METRIK', margin + 5, y + 6);
    
    doc.fillColor('#1e293b')
      .fontSize(8)
      .text('Hasil', pageWidth - margin - 40, y + 6, { align: 'right', width: 35 });

    y += 20;

    // Formula items
    const formulas: FormulaItem[] = [
      {
        name: 'Total Penjualan',
        formula: 'Σ: COUNT(penjualan) WHERE status = SOLD',
        calculation: 'H: 0 unit terjual',
        result: config.metrics.totalPenjualan
      },
      {
        name: 'Total Revenue',
        formula: 'Σ: SUM(harga) WHERE status = SOLD',
        calculation: 'H: Rp 0',
        result: this.formatCurrency(config.metrics.totalRevenue)
      }
    ];

    formulas.forEach((formula, idx) => {
      const bgColor = idx % 2 === 0 ? '#fef3c7' : '#ffffff';
      const borderColor = '#f59e0b';
      
      doc.fillColor(bgColor)
        .rect(margin, y, contentWidth, 35)
        .fill();
      
      // Left border
      doc.fillColor(borderColor)
        .rect(margin, y, 4, 35)
        .fill();
      
      // Formula name
      doc.fillColor('#1e293b')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(formula.name, margin + 10, y + 5);
      
      // Formula
      doc.fillColor('#6b7280')
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text(formula.formula, margin + 10, y + 16);
      
      // Calculation
      doc.fillColor('#6b7280')
        .fontSize(7)
        .font('Helvetica')
        .text(formula.calculation, margin + 10, y + 26);
      
      // Result
      doc.fillColor('#dc2626')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(formula.result.toString(), pageWidth - margin - 70, y + 12, { 
          align: 'right', 
          width: 65 
        });

      y += 35;
    });

    y += 15;

    // ==================== INSIGHT UTAMA ====================
    doc.fillColor('#fef3c7')
      .rect(margin, y, contentWidth, 25)
      .fill();
    
    // Yellow left border
    doc.fillColor('#f59e0b')
      .rect(margin, y, 4, 25)
      .fill();
    
    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('📊 INSIGHT UTAMA', margin + 10, y + 4);
    
    doc.fillColor('#6b7280')
      .fontSize(8)
      .font('Helvetica')
      .text(`Total Penjualan: ${config.metrics.totalPenjualan} Unit`, margin + 10, y + 14);

    y += 35;

    // ==================== DIAGRAM/CHART SECTION ====================
    const chartSectionHeight = 180;
    
    // Section border
    doc.strokeColor('#e5e7eb')
      .lineWidth(1)
      .rect(margin, y, contentWidth, chartSectionHeight)
      .stroke();
    
    // Section header
    doc.fillColor('#1e293b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Diagram/ chart', margin + 10, y + 10);
    
    doc.fillColor('#1e293b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN', margin + contentWidth / 2, y + 10);

    // Pie chart (left side)
    const chartX = margin + 80;
    const chartY = y + 50;
    const chartRadius = 50;
    
    // Draw pie chart with labels
    if (config.chartData && config.chartData.length > 0) {
      this.drawPieChart(chartX, chartY, chartRadius, config.chartData);
    } else {
      // Default placeholder chart
      const defaultData = [
        { label: 'A', value: 33, percentage: 33, color: '#3b82f6' },
        { label: 'B', value: 33, percentage: 33, color: '#8b5cf6' },
        { label: 'C', value: 34, percentage: 34, color: '#10b981' }
      ];
      this.drawPieChart(chartX, chartY, chartRadius, defaultData);
    }

    // Exm: label
    doc.fillColor('#1e293b')
      .fontSize(8)
      .font('Helvetica')
      .text('Exm:', margin + 10, y + 35);

    // Chart labels
    const labelY = y + 55;
    doc.fillColor('#1e293b')
      .fontSize(7)
      .font('Helvetica')
      .text('A = XXX %', margin + 55, labelY)
      .text('dalam', margin + 65, labelY + 8)
      .text('prosentase', margin + 60, labelY + 16);
    
    doc.text('B = XXX %', margin + 55, labelY + 30)
      .text('dalam', margin + 65, labelY + 38)
      .text('prosentase', margin + 60, labelY + 46);
    
    doc.text('C = XXX %', margin + 55, labelY + 60)
      .text('dalam', margin + 65, labelY + 68)
      .text('prosentase', margin + 60, labelY + 76);

    // Right side - Rumusan perhitungan list
    const formulaX = margin + contentWidth / 2 + 10;
    let formulaY = y + 30;
    
    doc.fillColor('#1e293b')
      .fontSize(7)
      .font('Helvetica')
      .text('- rumusan indikatornya ditampilkan:', formulaX, formulaY);
    
    formulaY += 10;
    doc.text('  exm: xxx...[*x/*/y/*+*/"-] xxx.... = hasil (prosentase)', formulaX, formulaY);
    
    formulaY += 15;
    doc.text('- indikator A. ditampilkan :', formulaX, formulaY);
    formulaY += 10;
    doc.text('  exm: xxx...[*x/*/y/*+*/"-] xxx.... = hasil (prosentase)', formulaX, formulaY);
    
    formulaY += 15;
    doc.text('- indikator B. ditampilkan :', formulaX, formulaY);
    formulaY += 10;
    doc.text('  exm: xxx...[*x/*/y/*+*/"-] xxx.... = hasil (prosentase)', formulaX, formulaY);
    
    formulaY += 20;
    doc.text('- Perhitungan data aktual di jelaskan sesuai rumusannya', formulaX, formulaY);
    
    formulaY += 15;
    doc.text('• Indokator A: ?%', formulaX + 20, formulaY);
    formulaY += 10;
    doc.text('• Indokator B: ?%', formulaX + 20, formulaY);
    formulaY += 10;
    doc.text('• Indokator C: ?%', formulaX + 20, formulaY);

    y += chartSectionHeight + 15;

    // ==================== ANALISA SHOWROOM SECTION ====================
    doc.fillColor('#1e293b')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Analisa Showroom:', margin, y);
    
    y += 14;

    const analysisItems = [
      'sebaiknya harus bagaimana untuk meningkatkan proforma/ kinerja/ performancenya?',
      'beri saran dan masukkan manajemen prima mobil harus bagaimana menjalankan keputusannya?',
      'jika ada indkator yang sudah baik sebaiknya: (dipertahankan atau di buat lebih sempurna atau mendekati sempurna atau sempurna'
    ];

    analysisItems.forEach((item) => {
      doc.fillColor('#dc2626')
        .fontSize(8)
        .font('Helvetica')
        .text(`- ${item}`, margin, y, { width: contentWidth });
      
      y += doc.heightOfString(`- ${item}`, { width: contentWidth }) + 3;
    });

    // ==================== FOOTER ====================
    const footerY = doc.page.height - 25;
    
    doc.fillColor('#f1f5f9')
      .rect(margin, footerY, contentWidth, 20)
      .fill();
    
    doc.fillColor('#94a3b8')
      .fontSize(7)
      .font('Helvetica')
      .text(
        `Generated by ${config.tenantName} | ${new Date().toLocaleString('id-ID')} | Data: Real-time from database`,
        pageWidth / 2, footerY + 6, 
        { align: 'center' }
      );
  }

  private drawPieChart(
    centerX: number, 
    centerY: number, 
    radius: number, 
    data: { label: string; value: number; percentage: number; color: string }[]
  ) {
    const { doc } = this;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let startAngle = -Math.PI / 2; // Start from top

    data.forEach((item) => {
      if (total === 0) return;

      const percentage = item.value / total;
      const angle = percentage * 2 * Math.PI;
      const endAngle = startAngle + angle;

      // Draw pie slice
      const startX = centerX + radius * Math.cos(startAngle);
      const startY = centerY + radius * Math.sin(startAngle);
      const endX = centerX + radius * Math.cos(endAngle);
      const endY = centerY + radius * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      doc.path(`M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`)
        .fill(item.color);

      startAngle = endAngle;
    });

    // Draw white lines between slices for separation effect
    startAngle = -Math.PI / 2;
    data.forEach((item) => {
      if (total === 0) return;
      
      const x = centerX + radius * Math.cos(startAngle);
      const y = centerY + radius * Math.sin(startAngle);
      
      doc.strokeColor('#ffffff')
        .lineWidth(2)
        .moveTo(centerX, centerY)
        .lineTo(x, y)
        .stroke();

      const percentage = item.value / total;
      startAngle += percentage * 2 * Math.PI;
    });
  }

  private formatCurrency(num: number): string {
    if (num === 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
  }
}

// Export helper function for easy usage
export async function generateSalesReportPDF(config: SalesReportConfig): Promise<Buffer> {
  const generator = new SalesReportPDF();
  return generator.generate(config);
}
