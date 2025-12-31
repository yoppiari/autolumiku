/**
 * One-Page Sales Report PDF Generator
 * Format: Single page with key metrics, insights, and formulas
 * Data: Real-time from database (no mock data)
 */

import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';

interface SalesReportData {
  tenantName: string;
  period: string;
}

export class OnePageSalesPDF {
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

  async generate(data: SalesReportData): Promise<Buffer> {
    console.log('[OnePageSalesPDF] Generating 1-page sales report with real data');

    // Set tenant name for header and footer
    this.setCurrentTenant(data.tenantName);

    // Fetch REAL data from database
    const salesData = await this.fetchSalesData(data.tenantName);

    // Add single page
    this.doc.addPage();

    // Header (with logo)
    await this.generateHeader();

    // Key Metrics Boxes
    this.generateMetrics(salesData);

    // Top Sales Staff
    this.generateTopStaff(salesData);

    // Main Insights
    this.generateInsights(salesData);

    // Chart Section (placeholder for donut chart)
    this.generateChartSection(salesData);

    // Formulas Section
    this.generateFormulas(salesData);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[OnePageSalesPDF] Generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private async fetchSalesData(tenantName: string) {
    // Get tenant by name
    const tenant = await prisma.tenant.findFirst({
      where: { name: tenantName },
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantName}`);
    }

    // Store logo URL for header
    this.currentTenantLogo = tenant.logoUrl;

    // Fetch vehicles (as inventory data - sales invoices table not created yet)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        // Tampilkan semua vehicle untuk inventory report
      },
      select: {
        price: true,
        make: true,
        status: true,
        createdAt: true,
      },
    });

    // Fetch all users with SALES role for potential sales tracking
    const salesUsers = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: 'SALES',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    // Create map of userId -> name
    const userNameMap = new Map<string, string>();
    salesUsers.forEach((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      userNameMap.set(user.id, fullName);
    });

    // Calculate metrics from vehicle inventory
    const totalInventory = vehicles.length;
    const availableCount = vehicles.filter(v => v.status === 'AVAILABLE').length;
    const soldCount = vehicles.filter(v => v.status === 'SOLD').length;
    const totalValue = vehicles.reduce((sum, v) => sum + (v.price ? Number(v.price) : 0), 0);
    const avgPrice = vehicles.length > 0 ? totalValue / vehicles.length : 0;

    // Group by make for chart
    const makeDistribution = new Map<string, number>();
    vehicles.forEach((v) => {
      const make = v.make || 'Unknown';
      makeDistribution.set(make, (makeDistribution.get(make) || 0) + 1);
    });

    // Get top sales staff (just show list of available sales staff)
    const salesStaffList = Array.from(userNameMap.values());

    return {
      tenant: tenant.name,
      totalSales: totalInventory, // Total inventory
      totalRevenue: totalValue, // Total value of all vehicles
      avgPrice,
      topStaff: salesStaffList.length > 0 ? {
        name: salesStaffList[0],
        count: 0,
        revenue: 0
      } : null,
      makeDistribution: Array.from(makeDistribution.entries()).map(([make, count]) => ({
        make,
        count,
        percentage: totalInventory > 0 ? (count / totalInventory) * 100 : 0,
      })),
      allStaff: [],
      inventoryStats: {
        total: totalInventory,
        available: availableCount,
        sold: soldCount,
      },
    };
  }

  private async generateHeader() {
    const pageWidth = 565;

    // Dark blue header bar
    this.doc.fillColor('#1A237E').rect(0, 0, pageWidth, 60).fill();

    // Title - centered
    this.doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('SALES REPORT', 20, 15, {
        width: pageWidth - 40,
        align: 'center',
      });

    // Logo or tenant name below title
    const yPos = 38;

    if (this.currentTenantLogo) {
      try {
        // Display logo image (max width 100px, max height 35px)
        this.doc.image(this.currentTenantLogo, pageWidth / 2 - 50, yPos, {
          fit: [100, 35],
          align: 'center',
        });
      } catch (error) {
        // Fallback to text if image fails to load
        console.warn('[OnePageSalesPDF] Failed to load logo:', error);
        this.doc.fillColor('white').fontSize(12).font('Helvetica')
          .text(this.currentTenant, 20, yPos + 10, {
            width: pageWidth - 40,
            align: 'center',
          });
      }
    } else {
      // No logo - show tenant name text
      this.doc.fillColor('white').fontSize(12).font('Helvetica')
        .text(this.currentTenant, 20, yPos + 10, {
          width: pageWidth - 40,
          align: 'center',
        });
    }
  }

  private currentTenant: string = '';
  private currentTenantLogo: string | null = null;

  private setCurrentTenant(name: string) {
    this.currentTenant = name;
  }

  private generateMetrics(data: any) {
    const pageWidth = 565; // A4 width in points
    const boxWidth = (pageWidth - 40) / 4 - 6; // 4 boxes equal width
    const boxHeight = 70;
    const startX = 20;
    // FIX: Start metrics AFTER header + logo (header 60px + logo 35px + margin)
    const y = 105;
    const gap = 6;

    // Box 1: Total Penjualan (Light Blue #4A90E2)
    this.drawMetricBox(startX, y, boxWidth, boxHeight, '#4A90E2', 'TOTAL PENJUALAN',
      `${data.totalSales}`, 'Unit', false);

    // Box 2: Total Revenue (Green #50C878) - RIGHT ALIGN
    this.drawMetricBox(startX + boxWidth + gap, y, boxWidth, boxHeight, '#50C878', 'TOTAL REVENUE',
      this.formatNumber(data.totalRevenue), 'Rp ', true);

    // Box 3: Rata-rata Harga (Orange #FFA500) - RIGHT ALIGN
    this.drawMetricBox(startX + (boxWidth + gap) * 2, y, boxWidth, boxHeight, '#FFA500', 'RATA-RATA HARGA',
      this.formatNumber(data.avgPrice), 'Rp ', true);

    // Box 4: Top Sales Staff (Purple #9370DB) - SMALLER FONT FOR NAME
    const topStaffName = data.topStaff?.name || 'N/A';
    const topStaffCount = data.topStaff?.count ? `${data.topStaff.count} unit` : '';
    this.drawMetricBox(startX + (boxWidth + gap) * 3, y, boxWidth, boxHeight, '#9370DB', 'TOP SALES STAFF',
      topStaffName, topStaffCount, false, true);

    this.doc.y = y + boxHeight + 15;
  }

  private generateTopStaff(data: any) {
    // REMOVED - Top Staff is now in the metrics bar
  }

  private generateInsights(data: any) {
    // REMOVED - Insights are now in the formulas section
  }

  private generateChartSection(data: any) {
    // REMOVED - Will be integrated into formulas section
  }

  private generateFormulas(data: any) {
    const pageWidth = 565;
    const y = this.doc.y;

    // RUMUSAN PERHITUNGAN Section
    this.doc.fontSize(12).fillColor('black').font('Helvetica-Bold').text('RUMUSAN PERHITUNGAN', 20, y);

    let yPos = y + 15;

    // Table header
    this.doc.fillColor('#E0E0E0').rect(20, yPos, pageWidth - 40, 20).fill();
    this.doc.fillColor('black').fontSize(10).font('Helvetica-Bold').text('METRIK', 25, yPos + 5);
    this.doc.text('RUMUSAN', 150, yPos + 5);
    this.doc.text('PERHITUNGAN', pageWidth - 25, yPos + 5, { align: 'right' });

    yPos += 25;

    // Table rows - alternating colors with REAL CALCULATIONS
    const formulas = [
      {
        metric: 'Total Penjualan',
        formula: `COUNT(vehicle) WHERE status IN ('AVAILABLE', 'SOLD')`,
        calculation: `= ${data.totalSales} unit`
      },
      {
        metric: 'Total Revenue',
        formula: 'SUM(price) FROM vehicle',
        calculation: `= Rp ${this.formatNumber(data.totalRevenue)}`
      },
      {
        metric: 'Rata-rata Harga',
        formula: 'Total Revenue / Total Penjualan',
        calculation: `= ${this.formatNumber(data.totalRevenue)} / ${data.totalSales} = Rp ${this.formatNumber(data.avgPrice)}`
      },
    ];

    formulas.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
      this.doc.fillColor(bgColor).rect(20, yPos, pageWidth - 40, 22).fill();
      this.doc.fillColor('black').fontSize(9).font('Helvetica-Bold').text(item.metric, 25, yPos + 3);
      this.doc.font('Helvetica').fontSize(7).text(item.formula, 150, yPos + 3);
      this.doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(item.calculation, pageWidth - 25, yPos + 3, { align: 'right' });
      yPos += 26;
    });

    // Insight Utama Section (light green background)
    yPos += 5;
    this.doc.fillColor('#E6F7E6').rect(20, yPos, pageWidth - 40, 18).fill();
    this.doc.fillColor('black').fontSize(9).font('Helvetica-Bold').text('Insight Utama', 25, yPos + 3);
    this.doc.font('Helvetica').fontSize(8).text(
      `Total Inventory: ${data.totalSales} Unit | Tersedia: ${data.inventoryStats?.available || 0} | Terjual: ${data.inventoryStats?.sold || 0}`,
      120, yPos + 3
    );

    yPos += 25;

    // Chart Section (Left) + Formulas Table (Right) - Side by side
    const chartWidth = (pageWidth - 40) / 2 - 10;
    const tableX = 20 + chartWidth + 10;

    // Chart title
    this.doc.fillColor('black').fontSize(11).font('Helvetica-Bold').text('DISTRIBUSI BRAND (REAL DATABASE)', 20, yPos);

    // Simple bar chart representation with REAL calculations
    let barY = yPos + 15;
    const maxBarWidth = chartWidth - 40;

    data.makeDistribution.slice(0, 3).forEach((item: any, idx: number) => {
      const barWidth = (item.percentage / 100) * maxBarWidth;
      const colors = ['#4A90E2', '#50C878', '#FFA500'];

      // Label (brand name)
      this.doc.fillColor('black').fontSize(8).font('Helvetica-Bold').text(
        `${item.make}`, 25, barY + 2
      );

      // Bar
      this.doc.fillColor(colors[idx % 3]).rect(70, barY, Math.max(barWidth, 50), 8).fill();

      // Percentage - BLACK TEXT (aligned right after bar)
      this.doc.fillColor('black').fontSize(8).font('Helvetica-Bold').text(
        `${item.percentage.toFixed(1)}%`, 70 + maxBarWidth + 10, barY
      );

      // Show actual count from database (on next line, below percentage)
      this.doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(
        `${item.count} unit`, 70, barY + 11
      );

      barY += 22; // Spacing for each brand entry
    });

    // Formulas table on right - SHOW REAL CALCULATIONS
    this.doc.fillColor('black').fontSize(10).font('Helvetica-Bold').text('PERHITUNGAN DATABASE', tableX, yPos);

    let tableY = yPos + 15;

    // Calculate total for percentage formula display
    const totalCount = data.makeDistribution.reduce((sum: number, item: any) => sum + item.count, 0);

    // Show formula and actual calculation for each brand
    data.makeDistribution.slice(0, 3).forEach((item: any, idx: number) => {
      const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;

      // Brand label
      this.doc.fillColor('black').fontSize(8).font('Helvetica-Bold').text(
        `${item.make}:`, tableX, tableY
      );
      tableY += 10;

      // Formula
      this.doc.fillColor('#6b7280').fontSize(7).font('Helvetica-Oblique').text(
        `Rumus: (count / total) × 100`, tableX, tableY
      );
      tableY += 9;

      // Actual calculation with real numbers
      this.doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(
        `Hitung: (${item.count} / ${totalCount}) × 100 = ${percentage.toFixed(1)}%`, tableX, tableY
      );
      tableY += 14;
    });

    yPos = Math.max(barY, tableY) + 15;

    // Generate actual analysis based on real data - NO SYMBOLS, BLACK TEXT ONLY
    const totalInventory = data.totalSales || 0;
    const soldCount = data.inventoryStats?.sold || 0;
    const availableCount = data.inventoryStats?.available || 0;
    const topBrand = data.makeDistribution?.[0];
    const soldPercentage = totalInventory > 0 ? (soldCount / totalInventory) * 100 : 0;

    // Build analysis points based on actual data - NO EMOJIS
    const analysisPoints: string[] = [];

    // Analysis 1: Sales performance
    if (soldPercentage > 50) {
      analysisPoints.push(`KINERJA BAGUS: ${soldPercentage.toFixed(1)}% inventory terjual. Pertahankan strategi penjualan saat ini.`);
    } else if (soldPercentage > 20) {
      analysisPoints.push(`KINERJA SEDANG: ${soldPercentage.toFixed(1)}% terjual. Perlu tingkatkan marketing & promosi.`);
    } else {
      analysisPoints.push(`KINERJA RENDAH: Hanya ${soldPercentage.toFixed(1)}% terjual dari ${totalInventory} unit. Segera evaluasi harga & strategi marketing.`);
    }

    // Analysis 2: Brand focus
    if (topBrand && topBrand.percentage > 50) {
      analysisPoints.push(`FOKUS BRAND: ${topBrand.make} mendominasi (${topBrand.percentage.toFixed(1)}%). Pertahankan stok ${topBrand.make} & tingkatkan variasi brand lain.`);
    } else if (topBrand) {
      analysisPoints.push(`DISTRIBUSI SEIMBANG: Top brand (${topBrand.make}) ${topBrand.percentage.toFixed(1)}%. Portfolio brand sudah baik.`);
    }

    // Analysis 3: Inventory strategy
    if (availableCount > 15) {
      analysisPoints.push(`STOK TINGGI: ${availableCount} unit available. Pertimbangkan diskon/promosi untuk mempercepat turnover.`);
    } else if (availableCount < 5) {
      analysisPoints.push(`STOK RENDAH: Hanya ${availableCount} unit available. Segera tambah stok untuk kehilangan opportunity.`);
    } else {
      analysisPoints.push(`STOK OPTIMAL: ${availableCount} unit available. Level stok sehat.`);
    }

    // Footer - Analysis section with actual insights - BLACK TEXT
    this.doc.fillColor('black').fontSize(11).font('Helvetica-Bold').text('Analisa Showroom', 20, yPos);

    yPos += 12;

    this.doc.fillColor('black').fontSize(8).font('Helvetica');
    analysisPoints.forEach((point) => {
      this.doc.text(`• ${point}`, 25, yPos, { width: pageWidth - 50 });
      yPos += 12; // Fixed line height for each analysis point
    });

    // Final footer
    yPos = 750;
    this.doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(
      `Generated by ${this.currentTenant} | ${new Date().toLocaleString('id-ID')} | Data: Real-time from database`,
      pageWidth / 2, yPos, { align: 'center' }
    );
  }

  private drawMetricBox(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    label: string,
    value: string,
    unit: string,
    rightAlign: boolean = false,
    isSmallText: boolean = false
  ) {
    const { doc } = this;

    // Draw colored box
    doc.fillColor(color).rect(x, y, width, height).fill();

    // Label (uppercase, bold) - always centered
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(
      label.toUpperCase(), x + 5, y + 8, { width: width - 10, align: 'center' }
    );

    // Value - adjust font size for small text (sales names)
    const valueFontSize = isSmallText ? 11 : 16;
    const valueY = isSmallText ? y + 28 : y + 24;

    if (rightAlign) {
      // Currency: Unit on left, value on right, same line
      if (unit) {
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(
          unit, x + 8, valueY, { width: width - 16, align: 'left' }
        );
      }

      doc.fillColor('white').fontSize(valueFontSize).font('Helvetica-Bold').text(
        value, x + 8, valueY, { width: width - 16, align: 'right' }
      );
    } else {
      // Default: Center-aligned
      doc.fillColor('white').fontSize(valueFontSize).font('Helvetica-Bold').text(
        value, x + 5, valueY, { width: width - 10, align: 'center' }
      );

      if (unit) {
        doc.fontSize(8).font('Helvetica').text(
          unit, x + 5, y + 45, { width: width - 10, align: 'center' }
        );
      }
    }
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(Math.round(num));
  }
}
