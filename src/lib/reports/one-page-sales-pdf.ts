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

    // Header
    this.generateHeader();

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
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantName}`);
    }

    // Fetch SOLD vehicles with sales data
    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'SOLD',
      },
      select: {
        price: true,
        soldDate: true,
        soldBy: true,
        make: true,
      },
    });

    // Calculate metrics from REAL data
    const totalSales = soldVehicles.length;
    const totalRevenue = soldVehicles.reduce((sum, v) => sum + (v.price || 0), 0);
    const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Group by sales staff
    const staffSales = new Map<string, { count: number; revenue: number }>();
    soldVehicles.forEach((v) => {
      const staff = v.soldBy || 'Unassigned';
      if (!staffSales.has(staff)) {
        staffSales.set(staff, { count: 0, revenue: 0 });
      }
      const data = staffSales.get(staff)!;
      data.count++;
      data.revenue += v.price || 0;
    });

    // Find top sales staff
    const topStaffEntries = Array.from(staffSales.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 1);

    const topStaff = topStaffEntries.length > 0
      ? { name: topStaffEntries[0][0], ...topStaffEntries[0][1] }
      : null;

    // Group by make for chart
    const makeSales = new Map<string, number>();
    soldVehicles.forEach((v) => {
      const make = v.make || 'Unknown';
      makeSales.set(make, (makeSales.get(make) || 0) + 1);
    });

    return {
      tenant: tenant.name,
      totalSales,
      totalRevenue,
      avgPrice,
      topStaff,
      makeDistribution: Array.from(makeSales.entries()).map(([make, count]) => ({
        make,
        count,
        percentage: totalSales > 0 ? (count / totalSales) * 100 : 0,
      })),
      allStaff: Array.from(staffSales.entries()).map(([name, data]) => ({
        name,
        ...data,
      })),
    };
  }

  private generateHeader() {
    // Title
    this.doc.fontSize(24).font('Helvetica-Bold').text('SALES REPORT', {
      align: 'center',
    });

    // Tenant name
    this.doc.fontSize(12).font('Helvetica').text(this.currentTenant, {
      align: 'center',
    });

    this.doc.moveDown(0.5);
  }

  private currentTenant: string = '';

  private setCurrentTenant(name: string) {
    this.currentTenant = name;
  }

  private generateMetrics(data: any) {
    const boxWidth = 170;
    const boxHeight = 80;
    const startX = 50;
    const y = this.doc.y;

    // Box 1: Total Penjualan
    this.drawBox(startX, y, boxWidth, boxHeight, '#4CAF50');
    this.doc.fontSize(12).fillColor('white').text('TOTAL PENJUALAN', startX + 10, y + 15, {
      width: boxWidth - 20,
      align: 'center',
    });
    this.doc.fontSize(28).text(`${data.totalSales}`, startX + 10, y + 35, {
      width: boxWidth - 20,
      align: 'center',
    });
    this.doc.fontSize(12).text('Unit', startX + 10, y + 60, {
      width: boxWidth - 20,
      align: 'center',
    });

    // Box 2: Total Revenue
    this.drawBox(startX + boxWidth + 20, y, boxWidth, boxHeight, '#2196F3');
    this.doc.fontSize(12).fillColor('white').text('TOTAL REVENUE', startX + boxWidth + 30, y + 15, {
      width: boxWidth - 20,
      align: 'center',
    });
    this.doc.fontSize(20).text(`Rp ${this.formatNumber(data.totalRevenue)}`, startX + boxWidth + 30, y + 35, {
      width: boxWidth - 20,
      align: 'center',
    });

    // Box 3: Rata-rata Harga
    this.drawBox(startX + (boxWidth + 20) * 2, y, boxWidth, boxHeight, '#FF9800');
    this.doc.fontSize(12).fillColor('white').text('RATA-RATA HARGA', startX + (boxWidth + 20) * 2 + 10, y + 15, {
      width: boxWidth - 20,
      align: 'center',
    });
    this.doc.fontSize(20).text(`Rp ${this.formatNumber(data.avgPrice)}`, startX + (boxWidth + 20) * 2 + 10, y + 35, {
      width: boxWidth - 20,
      align: 'center',
    });

    this.doc.y = y + boxHeight + 20;
  }

  private generateTopStaff(data: any) {
    const y = this.doc.y;

    this.doc.fontSize(14).fillColor('black').text('TOP SALES STAFF', 50, y);

    this.doc.rect(50, y + 15, 515, 50).fill('#f5f5f5').stroke();

    if (data.topStaff) {
      this.doc.fontSize(18).fillColor('black').text(data.topStaff.name, 70, y + 30);
      this.doc.fontSize(14).fillColor('#666').text(
        `${data.topStaff.count} unit • Rp ${this.formatNumber(data.topStaff.revenue)}`,
        70,
        y + 50
      );
    } else {
      this.doc.fontSize(14).fillColor('#999').text('N/A', 70, y + 35);
    }

    this.doc.y = y + 80;
  }

  private generateInsights(data: any) {
    const y = this.doc.y;

    this.doc.fontSize(14).fillColor('black').text('INSIGHT UTAMA', 50, y);

    this.doc.rect(50, y + 15, 515, 40).fill('#E3F2FD').stroke();

    this.doc.fontSize(12).fillColor('black').text(
      `Total Penjualan: ${data.totalSales} Unit`,
      70,
      y + 25
    );
    this.doc.fontSize(12).text(
      `Total Revenue: Rp ${this.formatNumber(data.totalRevenue)}`,
      70,
      y + 45
    );

    this.doc.y = y + 70;
  }

  private generateChartSection(data: any) {
    const y = this.doc.y;

    this.doc.fontSize(14).fillColor('black').text('DISTRIBUSI BERDASARKAN BRAND', 50, y);

    this.doc.rect(50, y + 15, 515, 80).fill('#fafafa').stroke();

    // Display make distribution
    let yPos = y + 25;
    data.makeDistribution.slice(0, 4).forEach((item: any) => {
      this.doc.fontSize(11).fillColor('black').text(
        `${item.make}: ${item.percentage.toFixed(1)}% (${item.count} unit)`,
        70,
        yPos
      );
      yPos += 15;
    });

    this.doc.y = y + 110;
  }

  private generateFormulas(data: any) {
    const y = this.doc.y;

    this.doc.fontSize(12).fillColor('black').text('RUMUSAN PERHITUNGAN:', 50, y);

    let yPos = y + 20;

    // Formula 1: Total Penjualan
    this.doc.fontSize(10).fillColor('#333').text(
      `• Total Penjualan:`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  R: COUNT(vehicle) WHERE status = "SOLD"`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  H: ${data.totalSales} unit terjual`,
      70,
      yPos
    );

    yPos += 20;

    // Formula 2: Total Revenue
    this.doc.fontSize(10).fillColor('#333').text(
      `• Total Revenue:`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  R: SUM(price) WHERE status = "SOLD"`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  H: Rp ${this.formatNumber(data.totalRevenue)}`,
      70,
      yPos
    );

    yPos += 20;

    // Formula 3: Rata-rata Harga
    this.doc.fontSize(10).fillColor('#333').text(
      `• Rata-rata Harga:`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  R: Total Revenue / Total Penjualan`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  H: Rp ${this.formatNumber(data.avgPrice)}`,
      70,
      yPos
    );

    // Footer
    this.doc.fontSize(8).fillColor('#999').text(
      `Generated by ${data.tenant} • ${new Date().toLocaleString('id-ID')} • Data: Real-time from database`,
      50,
      750,
      { align: 'center' }
    );
  }

  private drawBox(x: number, y: number, width: number, height: number, color: string) {
    this.doc.rect(x, y, width, height).fill(color).stroke();
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(Math.round(num));
  }
}
