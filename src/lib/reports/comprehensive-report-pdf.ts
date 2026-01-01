/**
 * Comprehensive Report PDF Generator
 * Supports 14 different report types with professional formatting
 * Based on WhatsAppCommandPDF design pattern
 */

import PDFDocument from 'pdfkit';

// ==================== TYPES ====================

export type ReportType =
    | 'sales-report' // Complete sales summary + staff rankings
    | 'whatsapp-analytics' // Conversation metrics + intent breakdown
    | 'sales-metrics' // KPIs + inventory metrics
    | 'customer-metrics' // Customer engagement data
    | 'operational-metrics' // Operational KPIs
    | 'sales-trends' // Daily trends over 30 days
    | 'staff-performance' // Individual rankings + details
    | 'recent-sales' // Last 7d, 1m, 1y sales
    | 'low-stock-alert' // Inventory warnings
    | 'total-sales' // Total units summary
    | 'total-revenue' // Revenue summary
    | 'total-inventory' // Current stock count
    | 'average-price' // Sales vs stock comparison
    | 'sales-summary' // Quick overview
    | 'management-insights'; // Business highlights & advice

export interface ComprehensiveReportConfig {
    type: ReportType;
    tenantName: string;
    logoUrl?: string;
    period?: {
        start: Date;
        end: Date;
        label?: string; // e.g., "7 Hari Terakhir", "Bulan Ini"
    };
    data: ReportData;
}

export interface ReportData {
    // Sales metrics
    totalSales?: number;
    totalRevenue?: number;
    totalInventory?: number;
    avgPrice?: number;
    avgStockPrice?: number;
    totalLeads?: number;
    totalCustomers?: number;

    // Trends (for charts)
    dailySales?: { date: Date; count: number; revenue: number }[];
    salesByBrand?: { brand: string; count: number; revenue: number }[];

    // Staff performance
    staffPerformance?: {
        name: string;
        sales: number;
        revenue: number;
        performance: 'Excellent' | 'Good' | 'Needs Improvement';
        details?: {
            displayId: string;
            vehicle: string;
            price: number;
            date: Date;
        }[];
    }[];

    // WhatsApp AI
    whatsapp?: {
        totalConversations: number;
        activeConversations: number;
        totalMessages: number;
        aiResponseRate: number;
        avgResponseTime: number;
        escalationRate: number;
        intentBreakdown: { intent: string; count: number; percentage: number }[];
    };

    // KPIs
    kpis?: {
        penjualanShowroom: number;
        atv: number;
        inventoryTurnover: number;
        customerRetention: number;
        nps: number;
        salesPerEmployee: number;
        efficiency: number;
    };

    // Inventory alerts
    lowStockVehicles?: {
        displayId: string;
        make: string;
        model: string;
        year: number;
        daysInStock: number;
        status: 'warning' | 'critical';
    }[];

    // Recent sales detail
    recentSalesDetail?: {
        displayId: string;
        make: string;
        model: string;
        year: number;
        price: number;
        soldDate: Date;
        salesPerson?: string;
    }[];

    // Inventory detail for Excel export
    inventoryDetail?: {
        displayId: string;
        make: string;
        model: string;
        year: number;
        price: number;
        daysInStock: number;
    }[];
    managementInsights?: string[];
}

interface Metric {
    label: string;
    value: string;
    unit?: string;
    color: string;
    subtitle?: string;
}

// ==================== MAIN CLASS ====================

export class ComprehensiveReportPDF {
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

    async generate(config: ComprehensiveReportConfig): Promise<Buffer> {
        console.log(`[ComprehensiveReport] 🚀 Generating ${config.type} report`);

        this.doc.addPage();
        this.generateReport(config);

        this.doc.end();

        await new Promise<void>((resolve) => {
            this.doc.on('end', resolve);
        });

        const pdfBuffer = Buffer.concat(this.chunks);
        return pdfBuffer;
    }

    // ==================== DRAWING HELPERS (RESKINNED FOR STANDARD v2) ====================

    private drawHeader(title: string, subtitle: string, config: ComprehensiveReportConfig) {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const headerHeight = 100;
        const margin = 30;

        // Blue Background
        doc.fillColor('#1e40af') // Dark Blue
            .rect(0, 0, pageWidth, headerHeight)
            .fill();

        // Title (White, Centered)
        doc.fillColor('#ffffff')
            .fontSize(20)
            .font('Helvetica-Bold')
            .text(`"${title.toUpperCase()}"`, 0, 30, { width: pageWidth, align: 'center' });

        // Tenant Name Badge (Darker Blue/Black bg with Red/Warning accent)
        const logoBoxWidth = 140;
        const logoBoxHeight = 30;
        const logoX = (pageWidth - logoBoxWidth) / 2;
        const logoY = 60;

        // Simulate Logo Box
        doc.fillColor('#0f172a').rect(logoX, logoY, logoBoxWidth, logoBoxHeight).fill(); // Black bg
        doc.fillColor('#ef4444').rect(logoX, logoY + 26, logoBoxWidth, 4).fill(); // Red underline stripe
        doc.fillColor('#ffffff')
            .fontSize(14)
            .font('Helvetica-BoldOblique')
            .text(config.tenantName.toUpperCase(), logoX, logoY + 6, { width: logoBoxWidth, align: 'center' });

        // Subtitle/Period (White, smaller under title)
        doc.fontSize(9).font('Helvetica')
            .text(subtitle, 0, 95, { width: pageWidth, align: 'center' });

        // Reset Y for content
        // Note: ComprehensiveReportPDF generators usually expect to start drawing content.
        // We'll reset fill color to black.
        doc.fillColor('#000000');
    }

    private drawMetricsGrid(metrics: Metric[], startY: number, itemsPerRow: number = 2): number {
        // Override itemsPerRow to 4 if we have 4 metrics to match standard
        // But some reports have 2 or 1. Let's adapt.
        // If 4 metrics & itemsPerRow is 2 (default), we force 4 for the "Standard Look"
        if (metrics.length === 4 && itemsPerRow === 2) itemsPerRow = 4;

        const { doc } = this;
        const margin = 30;
        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - margin * 2;

        // Adjust startY because header is 100px now
        startY = Math.max(startY, 130);

        const gap = 10;
        const cardWidth = (contentWidth - (gap * (itemsPerRow - 1))) / itemsPerRow;
        const cardHeight = 70;

        const metricColors = ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c']; // Standard Colors

        metrics.forEach((metric, idx) => {
            const row = Math.floor(idx / itemsPerRow);
            const col = idx % itemsPerRow;

            const x = margin + col * (cardWidth + gap);
            const y = startY + row * (cardHeight + gap);

            const color = metric.color || metricColors[idx % 4];

            // Card Bg
            doc.fillColor(color).roundedRect(x, y, cardWidth, cardHeight, 5).fill();

            // Label
            doc.fillColor('#ffffff')
                .fontSize(7)
                .font('Helvetica-Bold')
                .text(metric.label.toUpperCase(), x + 8, y + 8, { width: cardWidth - 16 });

            // Value
            doc.fontSize(16)
                .text(metric.value, x + 8, y + 25);

            // Subunit/Subtitle
            if (metric.unit || metric.subtitle) {
                doc.fontSize(8).text(metric.unit || metric.subtitle || '', x + 8, y + 48);
            }
        });

        const rows = Math.ceil(metrics.length / itemsPerRow);
        return startY + rows * (cardHeight + gap);
    }

    private drawSectionTitle(title: string, y: number): number {
        const { doc } = this;
        const margin = 30;

        doc.fillColor('#1e40af')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(title.toUpperCase(), margin, y);

        return y + 20;
    }

    private drawFooter(tenantName: string) {
        const { doc } = this;
        const pageHeight = doc.page.height;
        const margin = 30;
        const footerY = pageHeight - 30;

        doc.fontSize(8).fillColor('#94a3b8')
            .text(`Generated by ${tenantName} | ${new Date().toLocaleString('id-ID')}`,
                margin, footerY, { align: 'center', width: doc.page.width - margin * 2 });
    }

    // Existing Helpers - kept but updated to use new margins if needed
    private drawNoData(message: string) {
        const { doc } = this;
        doc.fillColor('#64748b').fontSize(10).font('Helvetica-Oblique')
            .text(message, 0, 200, { align: 'center', width: doc.page.width });
    }

    private drawHorizontalBars(data: { label: string; value: string; color: string }[], y: number): number {
        const { doc } = this;
        const margin = 30;
        const contentWidth = doc.page.width - margin * 2;
        const barH = 28;
        const barGap = 15;

        data.forEach(item => {
            // Label
            doc.fillColor('#475569').fontSize(8).font('Helvetica').text(item.label, margin, y);
            y += 11;
            // Bg
            doc.fillColor('#f8fafc').roundedRect(margin, y, contentWidth, barH, 3).fill();
            // Bar
            // Random-ish width for visualisation if value is text. real generic logic would need numbers.
            // But this method receives string values. We'll just draw a representative bar or full width
            doc.fillColor(item.color).roundedRect(margin, y, 5, barH, 3).fill();
            // Value
            doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(item.value, margin + 15, y + 8);
            y += barH + barGap;
        });
        return y;
    }

    private drawStaffTable(staff: ReportData['staffPerformance'], y: number) {
        // Implementation kept simple for brevity - ensuring it uses new margins
        if (!staff) return;
        const { doc } = this;
        const margin = 30;
        const width = doc.page.width - margin * 2;

        // Header
        doc.fillColor('#e2e8f0').rect(margin, y, width, 20).fill();
        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text('NAME', margin + 5, y + 6).text('SALES', margin + 150, y + 6).text('REVENUE', margin + 250, y + 6);

        y += 20;
        staff.slice(0, 20).forEach((s, idx) => { // limit to 20 for single page
            if (idx % 2 === 1) doc.fillColor('#f8fafc').rect(margin, y, width, 18).fill();
            doc.fillColor('#1e293b').fontSize(8).font('Helvetica')
                .text(s.name, margin + 5, y + 5)
                .text(String(s.sales), margin + 150, y + 5)
                .text(formatCurrency(s.revenue), margin + 250, y + 5);
            y += 18;
        });
    }

    private drawSalesTable(sales: any[], y: number) {
        // Similar adaptation
        const { doc } = this;
        const margin = 30;
        const width = doc.page.width - margin * 2;

        doc.fillColor('#e2e8f0').rect(margin, y, width, 20).fill();
        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text('MODEL', margin + 5, y + 6).text('PRICE', margin + 200, y + 6).text('DATE', margin + 350, y + 6);
        y += 20;

        sales.forEach((s, idx) => {
            if (idx % 2 === 1) doc.fillColor('#f8fafc').rect(margin, y, width, 18).fill();
            doc.fillColor('#1e293b').fontSize(8).font('Helvetica')
                .text(`${s.make} ${s.model}`, margin + 5, y + 5)
                .text(formatCurrency(s.price), margin + 200, y + 5)
                .text(new Date(s.soldDate).toLocaleDateString('id-ID'), margin + 350, y + 5);
            y += 18;
        });
    }

    private drawLowStockTable(vehicles: any[], y: number) {
        const { doc } = this;
        const margin = 30;
        const width = doc.page.width - margin * 2;
        doc.fillColor('#e2e8f0').rect(margin, y, width, 20).fill();
        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text('VEHICLE', margin + 5, y + 6).text('DAYS', margin + 200, y + 6).text('STATUS', margin + 350, y + 6);
        y += 20;
        vehicles.forEach((v, idx) => {
            if (idx % 2 === 1) doc.fillColor('#f8fafc').rect(margin, y, width, 18).fill();
            const color = v.status === 'critical' ? '#ef4444' : '#f59e0b';
            doc.fillColor('#1e293b').fontSize(8).font('Helvetica').text(`${v.make} ${v.model} (${v.year})`, margin + 5, y + 5);
            doc.fillColor(color).text(`${v.daysInStock} days`, margin + 200, y + 5).text(v.status.toUpperCase(), margin + 350, y + 5);
            y += 18;
        });
    }


    private generateReport(config: ComprehensiveReportConfig) {
        switch (config.type) {
            case 'sales-report':
                this.generateSalesReport(config);
                break;
            case 'whatsapp-analytics':
                this.generateWhatsAppAnalytics(config);
                break;
            case 'sales-metrics':
                this.generateSalesMetrics(config);
                break;
            case 'customer-metrics':
                this.generateCustomerMetrics(config);
                break;
            case 'operational-metrics':
                this.generateOperationalMetrics(config);
                break;
            case 'sales-trends':
                this.generateSalesTrends(config);
                break;
            case 'staff-performance':
                this.generateStaffPerformance(config);
                break;
            case 'recent-sales':
                this.generateRecentSales(config);
                break;
            case 'low-stock-alert':
                this.generateLowStockAlert(config);
                break;
            case 'total-sales':
                this.generateTotalSales(config);
                break;
            case 'total-revenue':
                this.generateTotalRevenue(config);
                break;
            case 'total-inventory':
                this.generateTotalInventory(config);
                break;
            case 'average-price':
                this.generateAveragePrice(config);
                break;
            case 'sales-summary':
                this.generateSalesSummary(config);
                break;
            case 'management-insights':
                this.generateManagementInsights(config);
                break;
            default:
                throw new Error(`Unknown report type: ${config.type}`);
        }
    }


    // ==================== REPORT GENERATORS ====================

    private generateSalesReport(config: ComprehensiveReportConfig) {
        const { data } = config;
        const periodLabel = config.period?.label || 'Periode Laporan';

        this.drawHeader('LAPORAN PENJUALAN LENGKAP', periodLabel, config);

        const metrics: Metric[] = [
            {
                label: 'Total Penjualan',
                value: String(data.totalSales || 0),
                unit: 'Unit',
                color: '#3b82f6',
            },
            {
                label: 'Total Revenue',
                value: formatCurrency(data.totalRevenue || 0),
                color: '#10b981',
            },
            {
                label: 'Rata-rata Harga',
                value: formatCurrency(data.avgPrice || 0),
                color: '#f59e0b',
            },
            {
                label: 'Total Stok',
                value: String(data.totalInventory || 0),
                unit: 'Unit',
                color: '#8b5cf6',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Sales by brand chart
        if (data.salesByBrand && data.salesByBrand.length > 0) {
            y = this.drawSectionTitle('PENJUALAN PER MEREK', y + 15);
            const chartData = data.salesByBrand.slice(0, 5).map((item, idx) => ({
                label: item.brand,
                value: `${item.count} unit (${formatCurrency(item.revenue)})`,
                color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
            }));
            y = this.drawHorizontalBars(chartData, y + 10);
        }

        // Staff performance table
        if (data.staffPerformance && data.staffPerformance.length > 0) {
            y = this.drawSectionTitle('RANKING STAFF', y + 20);
            this.drawStaffTable(data.staffPerformance, y + 10);
        }

        this.drawFooter(config.tenantName);
    }

    private generateWhatsAppAnalytics(config: ComprehensiveReportConfig) {
        const { data } = config;
        const periodLabel = config.period?.label || 'Periode Analisis';

        this.drawHeader('WHATSAPP AI ANALYTICS', periodLabel, config);

        if (!data.whatsapp) {
            this.drawNoData('Tidak ada data WhatsApp AI');
            this.drawFooter(config.tenantName);
            return;
        }

        const wa = data.whatsapp;
        const metrics: Metric[] = [
            {
                label: 'Total Conversations',
                value: String(wa.totalConversations),
                color: '#10b981',
            },
            {
                label: 'Active Chats',
                value: String(wa.activeConversations),
                color: '#3b82f6',
            },
            {
                label: 'AI Response Rate',
                value: `${wa.aiResponseRate}%`,
                color: '#8b5cf6',
            },
            {
                label: 'Avg Response Time',
                value: `${wa.avgResponseTime}s`,
                color: '#f59e0b',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Intent breakdown
        if (wa.intentBreakdown && wa.intentBreakdown.length > 0) {
            y = this.drawSectionTitle('INTENT BREAKDOWN', y + 15);
            const chartData = wa.intentBreakdown.map((item, idx) => ({
                label: item.intent.charAt(0).toUpperCase() + item.intent.slice(1),
                value: `${item.count} (${item.percentage}%)`,
                color: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#6b7280'][idx % 6],
            }));
            y = this.drawHorizontalBars(chartData, y + 10);
        }

        this.drawFooter(config.tenantName);
    }

    private generateSalesMetrics(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('METRIK PENJUALAN & KPI', config.period?.label || 'Report', config);

        const metrics: Metric[] = [
            {
                label: 'Penjualan Showroom',
                value: `${data.kpis?.penjualanShowroom || 0}%`,
                subtitle: 'Target Bulanan',
                color: '#3b82f6',
            },
            {
                label: 'ATV (Avg Transaction)',
                value: `${data.kpis?.atv || 0}%`,
                subtitle: 'vs Industry Avg',
                color: '#10b981',
            },
            {
                label: 'Inventory Turnover',
                value: `${data.kpis?.inventoryTurnover || 0}%`,
                subtitle: 'Stock Movement',
                color: '#f59e0b',
            },
            {
                label: 'Sales/Employee',
                value: `${data.kpis?.salesPerEmployee || 0}%`,
                subtitle: 'Productivity',
                color: '#8b5cf6',
            },
        ];

        this.drawMetricsGrid(metrics, 110);
        this.drawFooter(config.tenantName);
    }

    private generateCustomerMetrics(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('METRIK PELANGGAN', config.period?.label || 'Report', config);

        const metrics: Metric[] = [
            {
                label: 'Customer Retention',
                value: `${data.kpis?.customerRetention || 0}%`,
                color: '#10b981',
            },
            {
                label: 'NPS Score',
                value: `${data.kpis?.nps || 0}%`,
                color: '#f59e0b',
            },
            {
                label: 'Total Lead',
                value: String(data.totalLeads || 0),
                color: '#3b82f6',
            },
            {
                label: 'Pelanggan Terdaftar',
                value: String(data.totalCustomers || 0),
                color: '#8b5cf6',
            },
        ];

        this.drawMetricsGrid(metrics, 110);
        this.drawFooter(config.tenantName);
    }

    private generateOperationalMetrics(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('METRIK OPERASIONAL', config.period?.label || 'Report', config);

        const metrics: Metric[] = [
            {
                label: 'Overall Efficiency',
                value: `${data.kpis?.efficiency || 0}%`,
                color: '#8b5cf6',
            },
            {
                label: 'Sales per Employee',
                value: `${data.kpis?.salesPerEmployee || 0}%`,
                color: '#3b82f6',
            },
            {
                label: 'Inventory Velocity',
                value: `${data.kpis?.inventoryTurnover || 0}%`,
                color: '#f59e0b',
            },
            {
                label: 'Staff Active',
                value: String(data.staffPerformance?.length || 0),
                unit: 'Staff',
                color: '#10b981',
            },
        ];

        this.drawMetricsGrid(metrics, 110);
        this.drawFooter(config.tenantName);
    }

    private generateSalesTrends(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('TREN PENJUALAN HARIAN', config.period?.label || '30 Hari', config);

        if (!data.dailySales || data.dailySales.length === 0) {
            this.drawNoData('Tidak ada data trend penjualan');
            this.drawFooter(config.tenantName);
            return;
        }

        // Summary metrics
        const totalUnits = data.dailySales.reduce((sum, d) => sum + d.count, 0);
        const totalRev = data.dailySales.reduce((sum, d) => sum + d.revenue, 0);
        const avgDaily = totalUnits / data.dailySales.length;

        const metrics: Metric[] = [
            {
                label: 'Total Terjual',
                value: String(totalUnits),
                unit: 'Unit',
                color: '#3b82f6',
            },
            {
                label: 'Total Revenue',
                value: formatCurrency(totalRev),
                color: '#10b981',
            },
            {
                label: 'Rata-rata Harian',
                value: avgDaily.toFixed(1),
                unit: 'Unit/hari',
                color: '#f59e0b',
            },
            {
                label: 'Periode',
                value: String(data.dailySales.length),
                unit: 'Hari',
                color: '#8b5cf6',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Line chart (simplified as bars)
        y = this.drawSectionTitle('GRAFIK PENJUALAN HARIAN', y + 15);
        const chartData = data.dailySales.slice(-10).map((item) => ({
            label: new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            value: `${item.count} unit`,
            color: '#3b82f6',
        }));
        this.drawHorizontalBars(chartData, y + 10);

        this.drawFooter(config.tenantName);
    }

    private generateStaffPerformance(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('RANKING PERFORMA STAFF', config.period?.label || 'Report', config);

        if (!data.staffPerformance || data.staffPerformance.length === 0) {
            this.drawNoData('Tidak ada data staff');
            this.drawFooter(config.tenantName);
            return;
        }

        // Top 3 summary
        const top3 = data.staffPerformance.slice(0, 3);
        const metrics: Metric[] = top3.map((staff, idx) => ({
            label: `#${idx + 1} ${staff.name}`,
            value: String(staff.sales),
            unit: 'unit sales',
            color: ['#f59e0b', '#94a3b8', '#cd7f32'][idx] || '#6b7280',
        }));

        // Add total if space
        if (metrics.length < 4) {
            const totalSales = data.staffPerformance.reduce((sum, s) => sum + s.sales, 0);
            metrics.push({
                label: 'Total Team',
                value: String(totalSales),
                unit: 'unit',
                color: '#10b981',
            });
        }

        let y = this.drawMetricsGrid(metrics, 110);

        // Full staff table
        y = this.drawSectionTitle('RINGKASAN PERFORMA TEAM', y + 15);
        this.drawStaffTable(data.staffPerformance, y + 10);
        y += (data.staffPerformance.length * 18) + 40;

        // Individual Detail Sections for each staff
        if (y > 600) {
            this.doc.addPage();
            y = 40;
        }

        y = this.drawSectionTitle('RINCIAN PENJUALAN PER STAFF', y);

        data.staffPerformance.forEach((staff) => {
            if (staff.details && staff.details.length > 0) {
                if (y > 650) {
                    this.doc.addPage();
                    y = 40;
                }

                y = this.drawStaffDetailHeader(staff.name, y + 10);
                y = this.drawStaffIndividualSalesTable(staff.details, y + 5);
                y += 15;
            }
        });

        this.drawFooter(config.tenantName);
    }

    private drawStaffDetailHeader(name: string, y: number): number {
        const { doc } = this;
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text(name.toUpperCase(), 25, y);
        doc.fillColor('#94a3b8').rect(25, y + 12, 150, 1).fill();
        return y + 18;
    }

    private drawStaffIndividualSalesTable(details: any[], y: number): number {
        const { doc } = this;
        const margin = 25;
        const width = doc.page.width - margin * 2;

        // Header
        doc.fillColor('#f8fafc').rect(margin, y, width, 16).fill();
        doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold')
            .text('ID', margin + 5, y + 5, { width: 50 })
            .text('KENDARAAN', margin + 60, y + 5, { width: 200 })
            .text('HARGA', margin + 270, y + 5, { width: 100, align: 'right' })
            .text('TANGGAL', margin + 380, y + 5, { width: 70, align: 'right' });

        y += 20;

        details.forEach((d) => {
            doc.fillColor('#1e293b').fontSize(7).font('Helvetica')
                .text(d.displayId, margin + 5, y, { width: 50 })
                .text(d.vehicle, margin + 60, y, { width: 200 })
                .text(formatCurrency(d.price), margin + 270, y, { width: 100, align: 'right' })
                .text(new Date(d.date).toLocaleDateString('id-ID'), margin + 380, y, { width: 70, align: 'right' });
            y += 14;
        });

        return y;
    }

    private generateRecentSales(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('PENJUALAN TERKINI', config.period?.label || '7 Hari Terakhir', config);

        if (!data.recentSalesDetail || data.recentSalesDetail.length === 0) {
            this.drawNoData('Tidak ada penjualan dalam periode ini');
            this.drawFooter(config.tenantName);
            return;
        }

        const totalUnits = data.recentSalesDetail.length;
        const totalRev = data.recentSalesDetail.reduce((sum, s) => sum + s.price, 0);

        const metrics: Metric[] = [
            {
                label: 'Unit Terjual',
                value: String(totalUnits),
                color: '#3b82f6',
            },
            {
                label: 'Total Revenue',
                value: formatCurrency(totalRev),
                color: '#10b981',
            },
            {
                label: 'Rata-rata Harga',
                value: formatCurrency(totalRev / totalUnits),
                color: '#f59e0b',
            },
            {
                label: 'Periode',
                value: config.period?.label || '-',
                color: '#8b5cf6',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Sales detail table
        y = this.drawSectionTitle('DETAIL PENJUALAN', y + 15);
        this.drawSalesTable(data.recentSalesDetail.slice(0, 15), y + 10);

        this.drawFooter(config.tenantName);
    }

    private generateLowStockAlert(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('PERINGATAN STOK RENDAH', 'Inventory Alert', config);

        if (!data.lowStockVehicles || data.lowStockVehicles.length === 0) {
            this.drawNoData('Semua stok dalam kondisi baik');
            this.drawFooter(config.tenantName);
            return;
        }

        const critical = data.lowStockVehicles.filter(v => v.status === 'critical').length;
        const warning = data.lowStockVehicles.filter(v => v.status === 'warning').length;

        const metrics: Metric[] = [
            {
                label: 'Critical',
                value: String(critical),
                unit: 'unit',
                color: '#ef4444',
            },
            {
                label: 'Warning',
                value: String(warning),
                unit: 'unit',
                color: '#f59e0b',
            },
            {
                label: 'Total Alert',
                value: String(data.lowStockVehicles.length),
                color: '#8b5cf6',
            },
            {
                label: 'Total Stok',
                value: String(data.totalInventory || 0),
                unit: 'unit',
                color: '#10b981',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Alert table
        y = this.drawSectionTitle('DAFTAR PERINGATAN', y + 15);
        this.drawLowStockTable(data.lowStockVehicles.slice(0, 15), y + 10);

        this.drawFooter(config.tenantName);
    }

    private generateTotalSales(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('TOTAL PENJUALAN', config.period?.label || 'Report', config);

        const metrics: Metric[] = [
            {
                label: 'TOTAL UNITS SOLD',
                value: String(data.totalSales || 0),
                unit: 'Unit Terjual',
                color: '#3b82f6',
            },
        ];

        this.drawMetricsGrid(metrics, 110, 1); // Single large card
        this.drawFooter(config.tenantName);
    }

    private generateTotalRevenue(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('TOTAL REVENUE', config.period?.label || 'Report', config);

        const metrics: Metric[] = [
            {
                label: 'TOTAL REVENUE',
                value: formatCurrency(data.totalRevenue || 0),
                subtitle: 'Pendapatan Keseluruhan',
                color: '#10b981',
            },
        ];

        this.drawMetricsGrid(metrics, 110, 1);
        this.drawFooter(config.tenantName);
    }

    private generateTotalInventory(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('TOTAL INVENTORY', 'Current Stock', config);

        const metrics: Metric[] = [
            {
                label: 'TOTAL STOK',
                value: String(data.totalInventory || 0),
                unit: 'Unit Tersedia',
                color: '#8b5cf6',
            },
        ];

        this.drawMetricsGrid(metrics, 110, 1);
        this.drawFooter(config.tenantName);
    }

    private generateAveragePrice(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('RATA-RATA HARGA', 'Price Comparison', config);

        const metrics: Metric[] = [
            {
                label: 'Harga Jual (Sold)',
                value: formatCurrency(data.avgPrice || 0),
                subtitle: 'Rata-rata harga terjual',
                color: '#10b981',
            },
            {
                label: 'Harga Stok (Stock)',
                value: formatCurrency(data.avgStockPrice || 0),
                subtitle: 'Rata-rata harga stok',
                color: '#3b82f6',
            },
        ];

        this.drawMetricsGrid(metrics, 110, 2);
        this.drawFooter(config.tenantName);
    }

    private generateSalesSummary(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('RINGKASAN PENJUALAN', config.period?.label || 'Quick Overview', config);

        const metrics: Metric[] = [
            {
                label: 'Total Sales',
                value: String(data.totalSales || 0),
                unit: 'unit',
                color: '#3b82f6',
            },
            {
                label: 'Revenue',
                value: formatCurrency(data.totalRevenue || 0),
                color: '#10b981',
            },
            {
                label: 'Avg Price',
                value: formatCurrency(data.avgPrice || 0),
                color: '#f59e0b',
            },
            {
                label: 'Inventory',
                value: String(data.totalInventory || 0),
                unit: 'unit',
                color: '#8b5cf6',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        // Top brands
        if (data.salesByBrand && data.salesByBrand.length > 0) {
            y = this.drawSectionTitle('TOP BRANDS', y + 15);
            const chartData = data.salesByBrand.slice(0, 3).map((item, idx) => ({
                label: item.brand,
                value: `${item.count} unit`,
                color: ['#3b82f6', '#10b981', '#f59e0b'][idx],
            }));
            this.drawHorizontalBars(chartData, y + 10);
        }

        this.drawFooter(config.tenantName);
    }

    private generateManagementInsights(config: ComprehensiveReportConfig) {
        const { data } = config;
        this.drawHeader('MANAGEMENT INSIGHTS & ADVICE', config.period?.label || 'Analisis Bisnis', config);

        const metrics: Metric[] = [
            {
                label: 'Business Health',
                value: `${data.kpis?.efficiency || 0}%`,
                color: '#10b981',
                subtitle: 'Overall Score',
            },
            {
                label: 'Revenue',
                value: formatCurrency(data.totalRevenue || 0),
                color: '#3b82f6',
            },
            {
                label: 'Sales Volume',
                value: String(data.totalSales || 0),
                unit: 'Unit',
                color: '#f59e0b',
            },
            {
                label: 'Inventory Value',
                value: formatCurrency((data.inventoryDetail || []).reduce((sum, v) => sum + v.price, 0)),
                color: '#8b5cf6',
            },
        ];

        let y = this.drawMetricsGrid(metrics, 110);

        if (data.managementInsights && data.managementInsights.length > 0) {
            y = this.drawSectionTitle('ANALISIS & REKOMENDASI STRATEGIS', y + 15);
            y = this.drawInsightsList(data.managementInsights, y + 10);
        } else {
            this.drawNoData('Analisis sedang diproses...');
        }

        this.drawFooter(config.tenantName);
    }

    private drawInsightsList(insights: string[], y: number): number {
        const { doc } = this;
        const margin = 25;
        const width = doc.page.width - margin * 2;

        insights.forEach((insight, idx) => {
            if (y > 650) {
                this.doc.addPage();
                y = 40;
            }

            // Bullet icon
            doc.fillColor('#3b82f6').circle(margin + 10, y + 8, 8).fill();
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text(String(idx + 1), margin + 7, y + 4);

            // Text
            doc.fillColor('#334155').fontSize(9).font('Helvetica')
                .text(insight, margin + 25, y + 3, {
                    width: width - 40,
                    lineGap: 2,
                    align: 'justify'
                });

            const height = doc.heightOfString(insight, { width: width - 40, lineGap: 2 });
            y += height + 15;
        });

        return y;
    }

}
// ==================== HELPER FUNCTIONS ====================

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
