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

    // Box 1: Total Inventory
    this.drawBox(startX, y, boxWidth, boxHeight, '#4CAF50');
    this.doc.fontSize(12).fillColor('white').text('TOTAL INVENTORY', startX + 10, y + 15, {
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

    // Box 2: Total Value
    this.drawBox(startX + boxWidth + 20, y, boxWidth, boxHeight, '#2196F3');
    this.doc.fontSize(12).fillColor('white').text('TOTAL VALUE', startX + boxWidth + 30, y + 15, {
      width: boxWidth - 20,
      align: 'center',
    });
    this.doc.fontSize(20).text(`Rp ${this.formatNumber(data.totalRevenue)}`, startX + boxWidth + 30, y + 35, {
      width: boxWidth - 20,
      align: 'center',
    });

    // Box 3: Average Price
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

    this.doc.fontSize(14).fillColor('black').text('INSIGHT INVENTORY', 50, y);

    this.doc.rect(50, y + 15, 515, 40).fill('#E3F2FD').stroke();

    this.doc.fontSize(12).fillColor('black').text(
      `Total Inventory: ${data.totalSales} Unit`,
      70,
      y + 25
    );
    this.doc.fontSize(12).text(
      `Tersedia: ${data.inventoryStats?.available || 0} | Terjual: ${data.inventoryStats?.sold || 0}`,
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

    // Formula 1: Total Inventory
    this.doc.fontSize(10).fillColor('#333').text(
      `• Total Inventory:`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  R: COUNT(vehicle) WHERE tenantId = ${data.tenant}`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  H: ${data.totalSales} unit kendaraan`,
      70,
      yPos
    );

    yPos += 20;

    // Formula 2: Total Value
    this.doc.fontSize(10).fillColor('#333').text(
      `• Total Value:`,
      70,
      yPos
    );
    yPos += 12;
    this.doc.fontSize(9).fillColor('#666').text(
      `  R: SUM(price) FROM vehicle`,
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
      `  R: Total Value / Total Inventory`,
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
