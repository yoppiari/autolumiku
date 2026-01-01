/**
 * Vehicle Inventory PDF Generator
 * Creates PDF with vehicle listing table showing images, details, price, and status
 * Format based on the new design with:
 * - Header: Company name + Period
 * - Summary cards: Total Leads, Active Vehicles, Follow-up Required
 * - Vehicle table with images, make/model, price, status badges
 */

import PDFDocument from 'pdfkit';

interface Vehicle {
  id: string;
  displayId: string | null;
  make: string;
  model: string;
  year: number;
  price: number;
  status: 'AVAILABLE' | 'SOLD' | 'BOOKED' | 'DRAFT' | 'DELETED';
  imageUrl?: string;
  mileage?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
}

interface InventoryReportConfig {
  tenantName: string;
  logoUrl?: string;
  periodStart: Date;
  periodEnd: Date;
  vehicles: Vehicle[];
  metrics: {
    totalLeads: number;
    activeVehicles: number;
    followUpRequired: number;
  };
}

export class VehicleInventoryPDF {
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

  async generate(config: InventoryReportConfig): Promise<Buffer> {
    console.log('[VehicleInventoryPDF] 🚀 Generating Vehicle Inventory PDF');

    this.doc.addPage();
    await this.generatePage(config);

    this.doc.end();

    await new Promise<void>((resolve) => {
      this.doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(this.chunks);
    console.log('[VehicleInventoryPDF] ✅ PDF generated:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private async generatePage(config: InventoryReportConfig) {
    const { doc } = this;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let y = 30; // Top margin untuk logo space

    // ==================== HEADER ====================
    // Title at top (dengan margin untuk logo)
    doc.fillColor('#1e40af')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LAPORAN PENJUALAN', margin, y, { width: contentWidth, align: 'center' });

    y += 20;

    doc.fillColor('#1e40af')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(config.tenantName.toUpperCase(), margin, y, { width: contentWidth, align: 'center' });

    y += 18;

    // Period
    const periodText = `${this.formatDate(config.periodStart)} - ${this.formatDate(config.periodEnd)}`;
    doc.fillColor('#64748b')
      .fontSize(9)
      .font('Helvetica')
      .text(periodText, margin, y, { width: contentWidth, align: 'center' });

    y += 25;

    // ==================== SUMMARY CARDS ====================
    const cardCount = 3;
    const cardGap = 10;
    const cardWidth = (contentWidth - (cardGap * (cardCount - 1))) / cardCount;
    const cardHeight = 50;

    const cards = [
      { label: 'Total Leads', value: config.metrics.totalLeads.toString(), color: '#3b82f6' },
      { label: 'Active Vehicles', value: config.metrics.activeVehicles.toString(), color: '#10b981' },
      { label: 'Follow-up Required', value: config.metrics.followUpRequired.toString(), color: '#f59e0b' },
    ];

    cards.forEach((card, idx) => {
      const x = margin + idx * (cardWidth + cardGap);

      // Card background
      doc.fillColor(card.color)
        .roundedRect(x, y, cardWidth, cardHeight, 6)
        .fill();

      // Label
      doc.fillColor('#ffffff')
        .fontSize(8)
        .font('Helvetica')
        .text(card.label.toUpperCase(), x + 10, y + 10, { width: cardWidth - 20 });

      // Value
      doc.fillColor('#ffffff')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(card.value, x + 10, y + 22, { width: cardWidth - 20 });
    });

    y += cardHeight + 20;

    // ==================== VEHICLE TABLE ====================
    // Table header
    const tableHeaderHeight = 25;
    const colWidths = {
      image: 60,
      details: (contentWidth - 60 - 80 - 10) / 2,
      price: 80,
      status: 80,
    };

    // Draw table header background
    doc.fillColor('#f1f5f9')
      .rect(margin, y, contentWidth, tableHeaderHeight)
      .fill();

    // Header text
    doc.fillColor('#475569')
      .fontSize(9)
      .font('Helvetica-Bold');

    const headerY = y + 8;
    let headerX = margin + 5;

    doc.text('Foto', headerX, headerY);
    headerX += colWidths.image;

    doc.text('Kendaraan', headerX, headerY);
    headerX += colWidths.details;

    doc.text('Harga', headerX, headerY, { width: colWidths.price, align: 'right' });
    headerX += colWidths.price;

    doc.text('Status', headerX, headerY, { width: colWidths.status, align: 'center' });

    y += tableHeaderHeight;

    // Vehicle rows
    const rowHeight = 70;
    const maxRowsPerPage = Math.floor((pageHeight - y - 30) / rowHeight);

    for (let i = 0; i < config.vehicles.length; i++) {
      // New page if needed
      if (i > 0 && i % maxRowsPerPage === 0) {
        doc.addPage();
        y = margin;

        // Redraw table header
        doc.fillColor('#f1f5f9')
          .rect(margin, y, contentWidth, tableHeaderHeight)
          .fill();

        doc.fillColor('#475569')
          .fontSize(9)
          .font('Helvetica-Bold');

        const newHeaderY = y + 8;
        let newHeaderX = margin + 5;

        doc.text('Foto', newHeaderX, newHeaderY);
        newHeaderX += colWidths.image;

        doc.text('Kendaraan', newHeaderX, newHeaderY);
        newHeaderX += colWidths.details;

        doc.text('Harga', newHeaderX, newHeaderY, { width: colWidths.price, align: 'right' });
        newHeaderX += colWidths.price;

        doc.text('Status', newHeaderX, newHeaderY, { width: colWidths.status, align: 'center' });

        y += tableHeaderHeight;
      }

      const vehicle = config.vehicles[i];

      // Row background (alternating)
      const rowBgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.fillColor(rowBgColor)
        .rect(margin, y, contentWidth, rowHeight)
        .fill();

      // Row border
      doc.strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .rect(margin, y, contentWidth, rowHeight)
        .stroke();

      let cellX = margin + 5;
      const cellY = y + 5;

      // Image column - Try to load image synchronously without async
      if (vehicle.imageUrl) {
        try {
          // Use direct image URL loading (PDFKit handles HTTP/HTTPS)
          doc.image(vehicle.imageUrl, cellX, cellY, { fit: [50, 50], align: 'center' });
        } catch (error) {
          // Fallback placeholder
          doc.fillColor('#e2e8f0').rect(cellX, cellY, 50, 50).fill();
          doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
            .text('No Image', cellX, cellY + 20, { width: 50, align: 'center' });
        }
      } else {
        doc.fillColor('#e2e8f0')
          .rect(cellX, cellY, 50, 50)
          .fill();

        doc.fillColor('#94a3b8')
          .fontSize(7)
          .font('Helvetica')
          .text('No Image', cellX, cellY + 20, { width: 50, align: 'center' });
      }

      cellX += colWidths.image;

      // Details column
      doc.fillColor('#1e293b')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`${vehicle.make} ${vehicle.model}`, cellX, cellY, { width: colWidths.details - 10 });

      doc.fillColor('#64748b')
        .fontSize(8)
        .font('Helvetica')
        .text(`${vehicle.year} • ${vehicle.transmission || 'N/A'} • ${vehicle.fuelType || 'N/A'}`, cellX, cellY + 13, { width: colWidths.details - 10 });

      if (vehicle.mileage) {
        doc.text(`${this.formatNumber(vehicle.mileage)} km`, cellX, cellY + 25, { width: colWidths.details - 10 });
      }

      doc.fontSize(7)
        .fillColor('#94a3b8')
        .text(`ID: ${vehicle.displayId}`, cellX, cellY + 37, { width: colWidths.details - 10 });

      cellX += colWidths.details;

      // Price column (RIGHT ALIGNED)
      const priceText = this.formatCurrency(vehicle.price);
      doc.fillColor('#1e293b')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(priceText, cellX, cellY + 15, { width: colWidths.price - 10, align: 'right' });

      cellX += colWidths.price;

      // Status column with badge
      const statusColor = this.getStatusColor(vehicle.status);
      const statusText = this.getStatusLabel(vehicle.status);

      const badgeWidth = 70;
      const badgeHeight = 20;
      const badgeX = cellX + (colWidths.status - badgeWidth) / 2;
      const badgeY = cellY + 15;

      doc.fillColor(statusColor)
        .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 4)
        .fill();

      doc.fillColor('#ffffff')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(statusText, badgeX, badgeY + 5, { width: badgeWidth, align: 'center' });

      y += rowHeight;
    }

    // ==================== FOOTER ====================
    const currentY = doc.y;
    const footerY = pageHeight - 20;

    doc.fillColor('#f1f5f9')
      .rect(margin, footerY, contentWidth, 18)
      .fill();

    doc.fillColor('#94a3b8')
      .fontSize(6)
      .font('Helvetica')
      .text(
        `Generated by ${config.tenantName} | ${new Date().toLocaleString('id-ID')} | Total: ${config.vehicles.length} vehicles`,
        margin,
        footerY + 5,
        { width: contentWidth, align: 'center' }
      );
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return '#10b981'; // Green
      case 'SOLD':
        return '#ef4444'; // Red
      case 'BOOKED':
        return '#f59e0b'; // Orange
      case 'PENDING':
        return '#6366f1'; // Indigo
      default:
        return '#94a3b8'; // Gray
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Tersedia';
      case 'SOLD':
        return 'Terjual';
      case 'BOOKED':
        return 'Booked';
      case 'DRAFT':
        return 'Draft';
      case 'DELETED':
        return 'Terhapus';
      default:
        return status;
    }
  }

  private formatCurrency(num: number): string {
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

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}

export async function generateVehicleInventoryPDF(config: InventoryReportConfig): Promise<Buffer> {
  const generator = new VehicleInventoryPDF();
  return generator.generate(config);
}
