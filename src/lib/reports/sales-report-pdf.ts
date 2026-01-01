/**
 * Sales Report PDF Generator - Professional Draft Format
 * Creates 1-page PDF with metrics, formulas, chart, and showroom analysis
 * Based on the new draft design format
 * 
 * REVISI: Fix pie chart labels, korelasi data real-time, layout tidak out of box
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
    const headerHeight = 50;

    // Blue header background
    doc.fillColor('#1e3a8a').rect(0, 0, pageWidth, headerHeight).fill();

    // "SALES REPORT" title
    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('SALES REPORT', 0, 12, {
        align: 'center',
        width: pageWidth
      });

    // Tenant name badge
    const badgeText = config.tenantName.toUpperCase();
    doc.fontSize(8);
    const badgeWidth = doc.widthOfString(badgeText) + 20;
    const badgeX = (pageWidth - badgeWidth) / 2;
    const badgeY = 33;

    // Badge background
    doc.fillColor('#dc2626')
      .roundedRect(badgeX, badgeY, badgeWidth, 14, 3)
      .fill();

    doc.fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(badgeText, badgeX, badgeY + 3, { width: badgeWidth, align: 'center' });

    y = headerHeight + 8;

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
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN:', margin, y);

    y += 16;

    // Formula table header
    doc.fillColor('#e2e8f0')
      .roundedRect(margin, y, contentWidth, 18, 2)
      .fill();

    doc.fillColor('#1e293b')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('RUMUSAN PER METRIK', margin + 8, y + 5);

    doc.fillColor('#1e293b')
      .fontSize(7)
      .text('Hasil', pageWidth - margin - 50, y + 5, { align: 'right', width: 45 });

    y += 18;

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
      }
    ];

    formulas.forEach((formula, idx) => {
      const bgColor = idx % 2 === 0 ? '#fef9c3' : '#ffffff';
      const borderColor = '#eab308';
      const rowHeight = 32;

      doc.fillColor(bgColor)
        .rect(margin, y, contentWidth, rowHeight)
        .fill();

      // Left border
      doc.fillColor(borderColor)
        .rect(margin, y, 3, rowHeight)
        .fill();

      // Formula name
      doc.fillColor('#1e293b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(formula.name, margin + 10, y + 4);

      // Formula expression
      doc.fillColor('#64748b')
        .fontSize(6)
        .font('Helvetica-Oblique')
        .text(`R: ${formula.formula}`, margin + 10, y + 13, { width: contentWidth - 100 });

      // Calculation
      doc.fillColor('#64748b')
        .fontSize(6)
        .font('Helvetica')
        .text(formula.calculation, margin + 10, y + 22, { width: contentWidth - 100 });

      // Result - positioned to not overflow
      doc.fillColor('#dc2626')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(formula.result.toString(), pageWidth - margin - 80, y + 10, {
          align: 'right',
          width: 75
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
    const chartSectionHeight = 145;

    // Section border
    doc.strokeColor('#d1d5db')
      .lineWidth(1)
      .roundedRect(margin, y, contentWidth, chartSectionHeight, 4)
      .stroke();

    // Section headers
    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Diagram/ Chart', margin + 10, y + 8);

    const rightSectionX = margin + contentWidth / 2 + 5;
    doc.fillColor('#1e293b')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('RUMUSAN PERHITUNGAN', rightSectionX, y + 8);

    // Divider line
    doc.strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(margin + contentWidth / 2, y + 5)
      .lineTo(margin + contentWidth / 2, y + chartSectionHeight - 5)
      .stroke();

    // Pie chart (left side) - with REAL data
    const chartCenterX = margin + contentWidth / 4;
    const chartCenterY = y + 75;
    const chartRadius = 40;

    // Prepare chart data with real percentages
    let chartData = config.chartData || [];
    if (chartData.length === 0 && totalPenjualan > 0) {
      // Default: satu item jika tidak ada breakdown
      chartData = [{ label: 'Total', value: totalPenjualan, percentage: 100, color: '#3b82f6' }];
    }

    if (chartData.length > 0) {
      this.drawPieChartWithLabels(chartCenterX, chartCenterY, chartRadius, chartData);
    } else {
      // No data placeholder
      doc.fillColor('#e5e7eb')
        .circle(chartCenterX, chartCenterY, chartRadius)
        .fill();

      doc.fillColor('#9ca3af')
        .fontSize(8)
        .font('Helvetica')
        .text('No Data', chartCenterX - 15, chartCenterY - 4);
    }

    // Right side - Formula explanations dengan data REAL
    let formulaY = y + 25;
    const formulaLineHeight = 11;

    doc.fillColor('#1e293b')
      .fontSize(6.5)
      .font('Helvetica')
      .text('Rumusan indikator chart:', rightSectionX, formulaY);

    formulaY += formulaLineHeight;

    // Tampilkan rumusan untuk setiap segment chart
    if (chartData.length > 0) {
      const totalChartValue = chartData.reduce((sum, d) => sum + d.value, 0);

      chartData.slice(0, 4).forEach((item, idx) => {
        const pct = totalChartValue > 0 ? ((item.value / totalChartValue) * 100).toFixed(1) : '0';

        // Color indicator
        doc.fillColor(item.color)
          .circle(rightSectionX + 5, formulaY + 3, 3)
          .fill();

        doc.fillColor('#374151')
          .fontSize(6)
          .font('Helvetica')
          .text(`${item.label}: ${item.value} unit / ${totalChartValue} total × 100 = ${pct}%`, rightSectionX + 12, formulaY, { width: contentWidth / 2 - 25 });

        formulaY += formulaLineHeight;
      });

      formulaY += 5;

      // Summary
      doc.fillColor('#1e293b')
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .text('Hasil Perhitungan:', rightSectionX, formulaY);

      formulaY += formulaLineHeight;

      chartData.slice(0, 4).forEach((item) => {
        const pct = totalChartValue > 0 ? ((item.value / totalChartValue) * 100).toFixed(1) : '0';

        doc.fillColor(item.color)
          .circle(rightSectionX + 5, formulaY + 3, 3)
          .fill();

        doc.fillColor('#374151')
          .fontSize(6)
          .font('Helvetica-Bold')
          .text(`${item.label}: ${pct}%`, rightSectionX + 12, formulaY);

        formulaY += formulaLineHeight;
      });
    } else {
      doc.fillColor('#9ca3af')
        .fontSize(6)
        .font('Helvetica-Oblique')
        .text('Belum ada data penjualan untuk ditampilkan.', rightSectionX, formulaY);
    }

    y += chartSectionHeight + 12;

    // ==================== ANALISA SHOWROOM SECTION ====================
    doc.fillColor('#1e293b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Analisa Showroom:', margin, y);

    y += 12;

    // Dynamic analysis based on data
    const analysisItems = this.generateAnalysis(config);

    analysisItems.forEach((item) => {
      doc.fillColor('#b91c1c')
        .fontSize(7)
        .font('Helvetica')
        .text(`- ${item}`, margin, y, { width: contentWidth });

      y += doc.heightOfString(`- ${item}`, { width: contentWidth }) + 2;
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

  private drawPieChartWithLabels(
    centerX: number,
    centerY: number,
    radius: number,
    data: { label: string; value: number; percentage: number; color: string }[]
  ) {
    const { doc } = this;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let startAngle = -Math.PI / 2; // Start from top

    // Draw slices
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

      // Draw percentage label OUTSIDE the pie
      if (percentage > 0.03) { // Only show label if > 3%
        const midAngle = startAngle + angle / 2;
        const labelRadius = radius + 15; // Position label outside
        const labelX = centerX + labelRadius * Math.cos(midAngle);
        const labelY = centerY + labelRadius * Math.sin(midAngle);

        const pctText = `${(percentage * 100).toFixed(0)}%`;

        doc.fillColor('#1e293b')
          .fontSize(6)
          .font('Helvetica-Bold')
          .text(pctText, labelX - 10, labelY - 4, { width: 20, align: 'center' });
      }

      startAngle = endAngle;
    });

    // Draw white lines between slices
    startAngle = -Math.PI / 2;
    data.forEach((item) => {
      if (total === 0) return;

      const x = centerX + radius * Math.cos(startAngle);
      const y = centerY + radius * Math.sin(startAngle);

      doc.strokeColor('#ffffff')
        .lineWidth(1.5)
        .moveTo(centerX, centerY)
        .lineTo(x, y)
        .stroke();

      const percentage = item.value / total;
      startAngle += percentage * 2 * Math.PI;
    });

    // Legend below chart
    const legendY = centerY + radius + 25;
    const legendItemWidth = 55;
    const startLegendX = centerX - (Math.min(data.length, 3) * legendItemWidth) / 2;

    data.slice(0, 3).forEach((item, idx) => {
      const lx = startLegendX + idx * legendItemWidth;

      // Color box
      doc.fillColor(item.color)
        .rect(lx, legendY, 8, 8)
        .fill();

      // Label
      doc.fillColor('#374151')
        .fontSize(5.5)
        .font('Helvetica')
        .text(item.label.substring(0, 8), lx + 10, legendY + 1, { width: 40 });
    });
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
    analysis.push(`📋 LANGKAH SELANJUTNYA: (1) Target penjualan bulan depan: ${Math.max(totalPenjualan + 2, 5)} unit, (2) Follow-up leads yang pending, (3) Evaluasi stok vs permintaan pasar.`);

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
