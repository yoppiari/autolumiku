/**
 * Sales Report PDF Generator - Professional Draft Format
 * Creates 1-page PDF with metrics, formulas, chart, and showroom analysis
 * Based on the new draft design format
 * 
 * REVISI: Fix pie chart labels, korelasi data real-time, layout tidak out of box
 * REVISI 2: Font size adjustments, layout spacing
 * REVISI 3: Logo implementation, always show chart, black analysis text, larger legend font
 * REVISI 4: Header layout fix (Title Top, Logo Below), Add Top Sales metric, clean empty chart, clean analysis symbols
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
  // Chart data dengan persentase dari penjualan per merek kendaraan
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
    const margin = 25;
    const contentWidth = pageWidth - margin * 2;

    let y = 0;

    // ==================== HEADER ====================
    const headerHeight = 85;

    // Blue header background
    doc.fillColor('#1e3a8a').rect(0, 0, pageWidth, headerHeight).fill();

    // 1. Title at VERY TOP
    doc.fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('SALES REPORT', 0, 15, {
        align: 'center',
        width: pageWidth
      });

    // 2. LOGO Below Title
    const logoRelPath = 'public/prima-mobil-logo.jpg';
    const fs = require('fs');
    // Check both relative and absolute path just in case
    const path = require('path');
    const logoAbsPath = path.resolve(logoRelPath);

    let logoDrawn = false;

    try {
      if (fs.existsSync(logoAbsPath)) {
        const logoWidth = 120;
        // Centered below title (y=45)
        doc.image(logoAbsPath, (pageWidth - logoWidth) / 2, 45, { width: logoWidth });
        logoDrawn = true;
      }
    } catch (e) {
      console.error('Error drawing logo:', e);
    }

    if (!logoDrawn) {
      // Fallback: Badge below title
      const badgeText = config.tenantName.toUpperCase();
      doc.fontSize(10);
      const badgeWidth = doc.widthOfString(badgeText) + 30;
      const badgeX = (pageWidth - badgeWidth) / 2;
      const badgeY = 50;

      doc.fillColor('#dc2626')
        .roundedRect(badgeX, badgeY, badgeWidth, 18, 4)
        .fill();

      doc.fillColor('#ffffff')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(badgeText, badgeX, badgeY + 4, { width: badgeWidth, align: 'center' });
    }

    y = headerHeight + 12;

    // ==================== METRIC CARDS ====================
    const cardCount = 4;
    const cardGap = 6;
    const cardWidth = (contentWidth - (cardGap * (cardCount - 1))) / cardCount;
    const cardHeight = 48;

    const metricColors = ['#1e40af', '#16a34a', '#a855f7', '#f97316'];
    const metricLabels = ['TOTAL PENJUALAN', 'TOTAL REVENUE', 'RATA-RATA HARGA', 'TOP SALES STAFF'];
    const metricValues = [
      config.metrics.totalPenjualan.toString(),
      this.formatCurrencyShort(config.metrics.totalRevenue),
      this.formatCurrencyShort(config.metrics.rataRataHarga),
      config.metrics.topSalesStaff || 'N/A'
    ];
    const metricUnits = ['Unit', '', '', ''];

    for (let i = 0; i < cardCount; i++) {
      const x = margin + i * (cardWidth + cardGap);

      // Card background with rounded corners
      doc.fillColor(metricColors[i])
        .roundedRect(x, y, cardWidth, cardHeight, 4)
        .fill();

      // Label - smaller font to fit
      doc.fillColor('#ffffff')
        .fontSize(5.5)
        .font('Helvetica-Bold')
        .text(metricLabels[i], x + 4, y + 4, { width: cardWidth - 8 });

      // Value - adjust font size based on content
      const valueText = metricValues[i];
      const valueFontSize = i === 3 ? 8 : (valueText.length > 10 ? 10 : 13);

      doc.fillColor('#ffffff')
        .fontSize(valueFontSize)
        .font('Helvetica-Bold')
        .text(valueText, x + 4, y + 16, { width: cardWidth - 8 });

      // Unit
      if (metricUnits[i]) {
        doc.fillColor('#ffffff')
          .fontSize(6)
          .font('Helvetica')
          .text(metricUnits[i], x + 4, y + 38, { width: cardWidth - 8 });
      }
    }

    y += cardHeight + 12;

    // ==================== RUMUSAN PERHITUNGAN SECTION ====================
    doc.fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN:', margin, y);

    y += 20;

    // Formula table header
    doc.fillColor('#e2e8f0')
      .roundedRect(margin, y, contentWidth, 22, 2)
      .fill();

    doc.fillColor('#1e293b')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text('RUMUSAN PER METRIK', margin + 8, y + 6);

    doc.fillColor('#1e293b')
      .fontSize(8.5)
      .text('Hasil', pageWidth - margin - 50, y + 6, { align: 'right', width: 45 });

    y += 24;

    // Formula items dengan data REAL
    const totalPenjualan = config.metrics.totalPenjualan;
    const totalRevenue = config.metrics.totalRevenue;
    const rataRataHarga = config.metrics.rataRataHarga;

    const formulas: FormulaItem[] = [
      {
        name: 'Total Penjualan',
        formula: 'Σ: COUNT(vehicles) WHERE status = SOLD',
        calculation: `H: ${totalPenjualan} unit terjual`,
        result: totalPenjualan
      },
      {
        name: 'Total Revenue',
        formula: 'Σ: SUM(price) WHERE status = SOLD',
        calculation: `H: ${this.formatCurrency(totalRevenue)}`,
        result: this.formatCurrencyShort(totalRevenue)
      },
      {
        name: 'Rata-rata Harga',
        formula: 'AVG: SUM(price) / COUNT(vehicles) WHERE status = SOLD',
        calculation: `H: ${this.formatCurrency(totalRevenue)} / ${totalPenjualan} = ${this.formatCurrency(rataRataHarga)}`,
        result: this.formatCurrencyShort(rataRataHarga)
      },
      // REVISI: Add Top Sales Staff formula
      {
        name: 'Top Sales Staff',
        formula: 'MAX: COUNT(sales) BY sales_staff',
        calculation: `H: ${config.metrics.topSalesStaff || '-'}`,
        result: config.metrics.topSalesStaff ? '1st Rank' : '-'
      }
    ];

    formulas.forEach((formula, idx) => {
      const bgColor = idx % 2 === 0 ? '#fef9c3' : '#ffffff';
      const borderColor = '#eab308';
      const rowHeight = 42;

      doc.fillColor(bgColor)
        .rect(margin, y, contentWidth, rowHeight)
        .fill();

      // Left border
      doc.fillColor(borderColor)
        .rect(margin, y, 3, rowHeight)
        .fill();

      // Formula name
      doc.fillColor('#1e293b')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(formula.name, margin + 10, y + 5);

      // Formula expression
      doc.fillColor('#64748b')
        .fontSize(7.5)
        .font('Helvetica-Oblique')
        .text(`R: ${formula.formula}`, margin + 10, y + 16, { width: contentWidth - 100 });

      // Calculation
      doc.fillColor('#64748b')
        .fontSize(7.5)
        .font('Helvetica')
        .text(formula.calculation, margin + 10, y + 27, { width: contentWidth - 100 });

      // Result - positioned to not overflow
      doc.fillColor('#dc2626')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(formula.result.toString(), pageWidth - margin - 90, y + 12, {
          align: 'right',
          width: 85
        });

      y += rowHeight;
    });

    y += 10;

    // ==================== INSIGHT UTAMA ====================
    doc.fillColor('#fef3c7')
      .roundedRect(margin, y, contentWidth, 28, 3)
      .fill();

    // Yellow left border
    doc.fillColor('#f59e0b')
      .rect(margin, y, 3, 28)
      .fill();

    doc.fillColor('#1e293b')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('INSIGHT UTAMA', margin + 12, y + 5);

    // Insight dengan data real
    const avgRevenuePerUnit = totalPenjualan > 0 ? totalRevenue / totalPenjualan : 0;
    const insightText = totalPenjualan > 0
      ? `Total Penjualan: ${totalPenjualan} Unit | Revenue: ${this.formatCurrencyShort(totalRevenue)} | Avg/Unit: ${this.formatCurrencyShort(avgRevenuePerUnit)}`
      : 'Belum ada penjualan tercatat dalam periode ini.';

    doc.fillColor('#475569')
      .fontSize(7)
      .font('Helvetica')
      .text(insightText, margin + 12, y + 16, { width: contentWidth - 20 });

    y += 35;


    // ==================== DIAGRAM/CHART SECTION ====================
    // REVISI (Final): User requested to replace the "Pie Chart" logic with a specific list of metrics.
    // "diagram yang ditampilkan: - total penjualan, total revenue, rata-rata harga, dan top sales staff"
    // Also remove sidebar and vertical line.

    // Height can be smaller since it's just a list
    const chartSectionHeight = 165;

    // Section border
    doc.strokeColor('#d1d5db')
      .lineWidth(1)
      .roundedRect(margin, y, contentWidth, chartSectionHeight, 4)
      .stroke();

    // Section header - changed title slightly to reflect content
    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('VISUALISASI PERFORMA', margin + 10, y + 8);

    // Visualisation of the 4 metrics as horizontal bars/boxes
    // We use the full width since the vertical line is removed
    const visY = y + 35;
    const visH = 24; // Height of each bar
    const gap = 10;

    // Data mapping
    const visItems = [
      { label: 'Total Penjualan', value: `${config.metrics.totalPenjualan} Unit`, color: '#3b82f6' },
      { label: 'Total Revenue', value: this.formatCurrencyShort(config.metrics.totalRevenue), color: '#16a34a' },
      { label: 'Rata-rata Harga', value: this.formatCurrencyShort(config.metrics.rataRataHarga), color: '#a855f7' },
      { label: 'Top Sales Staff', value: config.metrics.topSalesStaff || '-', color: '#f97316' }
    ];

    visItems.forEach((item, idx) => {
      const rowY = visY + (idx * (visH + gap));
      const rowX = margin + 20;
      // Use almost full width
      const maxBarWidth = contentWidth - 40;

      // Label above bar
      doc.fillColor('#475569')
        .fontSize(8)
        .font('Helvetica')
        .text(item.label, rowX, rowY - 11);

      // Bar background (light gray)
      doc.fillColor('#f8fafc')
        .roundedRect(rowX, rowY, maxBarWidth, visH, 3)
        .fill();

      // Bar indicator (just a colored strip on the left to indicate category)
      doc.fillColor(item.color)
        .roundedRect(rowX, rowY, 5, visH, 3) // Left strip
        .fill();

      // Value Text inside bar (Left aligned next to strip)
      doc.fillColor('#1e293b')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(item.value, rowX + 15, rowY + 7);
    });

    y += chartSectionHeight + 12;

    // ==================== ANALISA SHOWROOM SECTION ====================
    doc.fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Analisa Showroom:', margin, y);

    y += 16;

    // Dynamic analysis based on data
    const analysisItems = this.generateAnalysis(config);

    analysisItems.forEach((item) => {
      // REVISI: Clean symbols
      const cleanItem = item.replace(/^[•\-\*><]+\s*/, '').trim();

      doc.fillColor('#000000') // REVISI: Changed to black
        .fontSize(9)
        .font('Helvetica')
        .text(`- ${cleanItem}`, margin, y, { width: contentWidth });

      y += doc.heightOfString(`- ${cleanItem}`, { width: contentWidth }) + 4;
    });

    // ==================== FOOTER ====================
    const footerY = doc.page.height - 22;

    doc.fillColor('#f1f5f9')
      .rect(margin, footerY, contentWidth, 18)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(6)
      .font('Helvetica')
      .text(
        `Generated by ${config.tenantName} | ${new Date().toLocaleString('id-ID')} | Data: Real-time from database`,
        margin, footerY + 5,
        { width: contentWidth, align: 'center' }
      );
  }



  private generateAnalysis(config: SalesReportConfig): string[] {
    const { totalPenjualan, totalRevenue, rataRataHarga, topSalesStaff } = config.metrics;
    const chartData = config.chartData || [];

    const analysis: string[] = [];

    // === KONDISI: TIDAK ADA PENJUALAN ===
    if (totalPenjualan === 0) {
      analysis.push('⚠️ PERLU DIPERBAIKI: Belum ada penjualan tercatat periode ini. Segera evaluasi strategi marketing, lead generation, dan follow-up customer.');
      analysis.push('📋 LANGKAH SELANJUTNYA: (1) Review pricing strategy, (2) Tingkatkan aktivitas promosi digital/offline, (3) Training tim sales untuk closing skill.');
      analysis.push('💡 SARAN: Pertimbangkan promo diskon atau bundling untuk menarik minat pembeli baru.');
      return analysis;
    }

    // === ANALISA PERFORMA PENJUALAN ===
    const revenueFormatted = this.formatCurrencyShort(totalRevenue);
    const avgFormatted = this.formatCurrencyShort(rataRataHarga);

    // Performance assessment
    if (totalPenjualan >= 10) {
      analysis.push(`✅ PERTAHANKAN: Penjualan ${totalPenjualan} unit dengan revenue ${revenueFormatted} menunjukkan performa baik. Pertahankan strategi saat ini dan tingkatkan target.`);
    } else if (totalPenjualan >= 5) {
      analysis.push(`📈 TINGKATKAN: Penjualan ${totalPenjualan} unit cukup stabil. Fokus tingkatkan volume dengan memperluas jangkauan marketing dan database customer.`);
    } else {
      analysis.push(`⚠️ PERLU DIPERBAIKI: Penjualan ${totalPenjualan} unit masih di bawah optimal. Review strategi penjualan dan identifikasi hambatan konversi.`);
    }

    // === ANALISA PRICING ===
    if (rataRataHarga > 200_000_000) {
      analysis.push(`💰 PRICING: Rata-rata ${avgFormatted}/unit termasuk segment premium. Pastikan value proposition dan after-sales service sesuai ekspektasi customer premium.`);
    } else if (rataRataHarga > 100_000_000) {
      analysis.push(`💰 PRICING: Rata-rata ${avgFormatted}/unit di segment menengah. Evaluasi kompetitor dan pastikan pricing kompetitif dengan fitur yang ditawarkan.`);
    } else {
      analysis.push(`💰 PRICING: Rata-rata ${avgFormatted}/unit. Pertimbangkan upselling atau cross-selling untuk meningkatkan average transaction value.`);
    }

    // === ANALISA TOP PERFORMER ===
    if (topSalesStaff) {
      analysis.push(`👤 TOP PERFORMER: ${topSalesStaff} - Jadikan role model, share best practices ke tim, dan pertimbangkan insentif untuk mempertahankan motivasi.`);
    } else {
      analysis.push(`👤 TIM SALES: Belum ada data top performer. Implementasikan sistem tracking performa dan buat program reward untuk meningkatkan kompetisi sehat.`);
    }

    // === ANALISA DISTRIBUSI MERK (dari chart) ===
    if (chartData.length > 0) {
      const topBrand = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0]);
      const totalUnits = chartData.reduce((sum, item) => sum + item.value, 0);
      const topPct = totalUnits > 0 ? ((topBrand.value / totalUnits) * 100).toFixed(0) : '0';

      analysis.push(`🚗 BRAND FOKUS: ${topBrand.label} mendominasi (${topPct}%). Perkuat stok brand ini dan evaluasi kenapa brand lain kurang diminati.`);
    }

    // === SARAN LANGKAH SELANJUTNYA ===
    analysis.push('📋 LANGKAH SELANJUTNYA: (1) Tetapkan target penjualan bulan depan yang progresif, (2) Follow-up leads yang pending, (3) Evaluasi stok vs permintaan pasar.');

    return analysis;
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

  private formatCurrencyShort(num: number): string {
    if (num === 0) return 'Rp 0';
    if (num >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toFixed(0)}Jt`;
    }
    if (num >= 1_000) {
      return `Rp ${(num / 1_000).toFixed(0)}Rb`;
    }
    return `Rp ${num}`;
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
