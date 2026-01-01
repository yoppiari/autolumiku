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
    | 'sales-summary'; // Quick overview

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

    // Trends (for charts)
    dailySales?: { date: Date; count: number; revenue: number }[];
    salesByBrand?: { brand: string; count: number; revenue: number }[];

    // Staff performance
    staffPerformance?: {
        name: string;
        sales: number;
        revenue: number;
        performance: 'Excellent' | 'Good' | 'Needs Improvement';
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
            margin: 20,
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

        return Buffer.concat(this.chunks);
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
                label: 'Total Pelanggan',
                value: String(data.whatsapp?.totalConversations || 0),
                color: '#3b82f6',
            },
            {
                label: 'Pelanggan Aktif',
                value: String(data.whatsapp?.activeConversations || 0),
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
        y = this.drawSectionTitle('DETAIL PERFORMA', y + 15);
        this.drawStaffTable(data.staffPerformance, y + 10);

        this.drawFooter(config.tenantName);
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

    // ==================== DRAWING UTILITIES ====================

    private drawHeader(title: string, subtitle: string, config: ComprehensiveReportConfig) {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const margin = 25;
        const contentWidth = pageWidth - margin * 2;

        // Title
        doc.fillColor('#1e40af')
            .fontSize(16)
            .font('Helvetica-Bold')
            .text(title, margin, 15, { width: contentWidth, align: 'center' });

        // Tenant Badge
        const logoY = 40;
        this.drawTenantBadge(doc, config.tenantName, pageWidth, logoY);

        // Subtitle
        doc.fillColor('#64748b')
            .fontSize(9)
            .font('Helvetica')
            .text(subtitle, margin, logoY + 35, { width: contentWidth, align: 'center' });

        // Date
        doc.fontSize(7)
            .fillColor('#94a3b8')
            .text(`Date: ${this.formatDate(new Date())}`, pageWidth - 100, 15, { width: 75, align: 'right' });
    }

    private drawMetricsGrid(metrics: Metric[], startY: number, columns: number = 2): number {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const margin = 25;
        const contentWidth = pageWidth - margin * 2;
        const gap = 12;
        const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
        const cardHeight = 60;

        metrics.forEach((metric, idx) => {
            const col = idx % columns;
            const row = Math.floor(idx / columns);
            const x = margin + col * (cardWidth + gap);
            const y = startY + row * (cardHeight + gap);
            this.drawMetricCard(x, y, cardWidth, cardHeight, metric);
        });

        const rows = Math.ceil(metrics.length / columns);
        return startY + rows * (cardHeight + gap);
    }

    private drawMetricCard(x: number, y: number, width: number, height: number, metric: Metric) {
        const { doc } = this;
        doc.fillColor(metric.color).rect(x, y, width, height).fill();
        doc.fillColor('#ffffff')
            .fontSize(7)
            .font('Helvetica-Bold')
            .text(metric.label.toUpperCase(), x + 8, y + 10, { width: width - 16 });

        doc.fontSize(18)
            .font('Helvetica-Bold')
            .text(metric.value, x + 8, y + 24, { width: width - 16 });

        if (metric.unit) {
            doc.fontSize(8)
                .font('Helvetica')
                .text(metric.unit, x + 8, y + 46);
        } else if (metric.subtitle) {
            doc.fontSize(7)
                .font('Helvetica')
                .text(metric.subtitle, x + 8, y + 46, { width: width - 16 });
        }
    }

    private drawSectionTitle(title: string, y: number): number {
        const { doc } = this;
        const margin = 25;
        doc.fillColor('#1e40af')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(title, margin, y);
        return y + 15;
    }

    private drawHorizontalBars(data: { label: string; value: string; color: string }[], startY: number): number {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const margin = 25;
        const contentWidth = pageWidth - margin * 2;
        const barH = 28;
        const barGap = 15;
        let y = startY;

        data.forEach((item) => {
            // Label
            doc.fillColor('#475569')
                .fontSize(8)
                .font('Helvetica')
                .text(item.label, margin, y);
            y += 11;

            // Bar background
            doc.fillColor('#f8fafc')
                .roundedRect(margin, y, contentWidth, barH, 3)
                .fill();

            // Left stripe
            doc.fillColor(item.color)
                .roundedRect(margin, y, 5, barH, 3)
                .fill();

            // Value
            doc.fillColor('#1e293b')
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(item.value, margin + 15, y + 8);

            y += barH + barGap;
        });

        return y;
    }

    private drawStaffTable(staff: { name: string; sales: number; revenue: number; performance: string }[], y: number) {
        const { doc } = this;
        const margin = 25;
        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - margin * 2;

        // Table header
        doc.fillColor('#f1f5f9').rect(margin, y, contentWidth, 20).fill();
        doc.fillColor('#1e293b')
            .fontSize(8)
            .font('Helvetica-Bold')
            .text('#', margin + 5, y + 6, { width: 20 })
            .text('NAMA', margin + 30, y + 6, { width: 120 })
            .text('SALES', margin + 155, y + 6, { width: 50, align: 'right' })
            .text('REVENUE', margin + 210, y + 6, { width: 130, align: 'right' })
            .text('PERFORMA', margin + 345, y + 6, { width: 100, align: 'right' });

        y += 25;

        // Table rows
        staff.slice(0, 10).forEach((s, idx) => {
            const perfColor = s.performance === 'Excellent' ? '#10b981' : s.performance === 'Good' ? '#3b82f6' : '#f59e0b';

            doc.fillColor('#334155')
                .fontSize(8)
                .font('Helvetica')
                .text(String(idx + 1), margin + 5, y, { width: 20 })
                .text(s.name, margin + 30, y, { width: 120 })
                .text(String(s.sales), margin + 155, y, { width: 50, align: 'right' })
                .text(formatCurrency(s.revenue), margin + 210, y, { width: 130, align: 'right' });

            doc.fillColor(perfColor)
                .fontSize(7)
                .font('Helvetica-Bold')
                .text(s.performance, margin + 345, y, { width: 100, align: 'right' });

            y += 18;
        });
    }

    private drawSalesTable(sales: { displayId: string; make: string; model: string; year: number; price: number; soldDate: Date }[], y: number) {
        const { doc } = this;
        const margin = 25;
        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - margin * 2;

        // Header
        doc.fillColor('#f1f5f9').rect(margin, y, contentWidth, 20).fill();
        doc.fillColor('#1e293b')
            .fontSize(7)
            .font('Helvetica-Bold')
            .text('ID', margin + 5, y + 6, { width: 50 })
            .text('KENDARAAN', margin + 60, y + 6, { width: 140 })
            .text('TAHUN', margin + 205, y + 6, { width: 40 })
            .text('HARGA', margin + 250, y + 6, { width: 110, align: 'right' })
            .text('TGL JUAL', margin + 365, y + 6, { width: 80, align: 'right' });

        y += 24;

        sales.forEach((s) => {
            doc.fillColor('#334155')
                .fontSize(7)
                .font('Helvetica')
                .text(s.displayId, margin + 5, y, { width: 50 })
                .text(`${s.make} ${s.model}`, margin + 60, y, { width: 140 })
                .text(String(s.year), margin + 205, y, { width: 40 })
                .text(formatCurrency(s.price), margin + 250, y, { width: 110, align: 'right' })
                .text(new Date(s.soldDate).toLocaleDateString('id-ID'), margin + 365, y, { width: 80, align: 'right' });

            y += 16;
        });
    }

    private drawLowStockTable(vehicles: { displayId: string; make: string; model: string; year: number; daysInStock: number; status: string }[], y: number) {
        const { doc } = this;
        const margin = 25;
        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - margin * 2;

        // Header
        doc.fillColor('#f1f5f9').rect(margin, y, contentWidth, 20).fill();
        doc.fillColor('#1e293b')
            .fontSize(7)
            .font('Helvetica-Bold')
            .text('ID', margin + 5, y + 6, { width: 50 })
            .text('KENDARAAN', margin + 60, y + 6, { width: 140 })
            .text('TAHUN', margin + 205, y + 6, { width: 40 })
            .text('HARI DI STOK', margin + 250, y + 6, { width: 90, align: 'right' })
            .text('STATUS', margin + 345, y + 6, { width: 100, align: 'right' });

        y += 24;

        vehicles.forEach((v) => {
            const statusColor = v.status === 'critical' ? '#ef4444' : '#f59e0b';

            doc.fillColor('#334155')
                .fontSize(7)
                .font('Helvetica')
                .text(v.displayId, margin + 5, y, { width: 50 })
                .text(`${v.make} ${v.model}`, margin + 60, y, { width: 140 })
                .text(String(v.year), margin + 205, y, { width: 40 })
                .text(`${v.daysInStock} hari`, margin + 250, y, { width: 90, align: 'right' });

            doc.fillColor(statusColor)
                .fontSize(7)
                .font('Helvetica-Bold')
                .text(v.status.toUpperCase(), margin + 345, y, { width: 100, align: 'right' });

            y += 16;
        });
    }

    private drawNoData(message: string) {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        doc.fillColor('#94a3b8')
            .fontSize(12)
            .font('Helvetica')
            .text(message, 0, pageHeight / 2 - 20, { width: pageWidth, align: 'center' });
    }

    private drawFooter(tenantName: string) {
        const { doc } = this;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 25;
        const contentWidth = pageWidth - margin * 2;
        const footerY = pageHeight - 25;

        doc.fillColor('#f1f5f9').rect(margin, footerY, contentWidth, 20).fill();
        doc.fillColor('#94a3b8')
            .fontSize(7)
            .font('Helvetica')
            .text(
                `Generated by ${tenantName} | Real-time Database | ${new Date().toLocaleString('id-ID')}`,
                margin,
                footerY + 6,
                { width: contentWidth, align: 'center' }
            );
    }

    private drawTenantBadge(doc: PDFKit.PDFDocument, name: string, pageWidth: number, y: number) {
        const badgeWidth = 120;
        const badgeHeight = 22;
        const x = (pageWidth - badgeWidth) / 2;
        doc.fillColor('#e2e8f0').roundedRect(x, y, badgeWidth, badgeHeight, 11).fill();
        doc.fillColor('#475569')
            .fontSize(9)
            .font('Helvetica-Bold')
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
