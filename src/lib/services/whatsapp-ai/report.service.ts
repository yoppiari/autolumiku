import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/utils";

export class WhatsAppReportService {
    /**
     * Main entry point for fetching reports based on keyword
     */
    static async getReport(reportType: string, tenantId: string): Promise<string> {
        console.log(`[Report Service] Generating report: ${reportType} for tenant: ${tenantId}`);

        switch (reportType.toLowerCase()) {
            // ✅ Sales & Revenue
            case 'sales_report':
            case 'laporan_penjualan':
                return await this.getSalesReport(tenantId);
            case 'total_sales':
            case 'total_penjualan':
                return await this.getTotalSales(tenantId);
            case 'total_revenue':
            case 'pendapatan':
                return await this.getTotalRevenue(tenantId);
            case 'sales_trends':
            case 'tren_penjualan':
                return await this.getSalesTrends(tenantId);
            case 'sales_metrics':
            case 'metrik_penjualan':
                return await this.getSalesMetrics(tenantId);
            case 'sales_summary':
            case 'ringkasan_cepat':
                return await this.getSalesSummary(tenantId);

            // ✅ Inventory & Stock
            case 'total_inventory':
            case 'laporan_stok':
                return await this.getTotalInventory(tenantId);
            case 'vehicle_listing':
            case 'daftar_kendaraan':
                return await this.getVehicleListing(tenantId);
            case 'low_stock_alert':
            case 'peringatan_stok':
                return await this.getLowStockAlert(tenantId);
            case 'average_price':
            case 'analisis_harga':
                return await this.getAveragePrice(tenantId);

            // ✅ Team & Performance
            case 'staff_performance':
            case 'performa_sales':
                return await this.getStaffPerformance(tenantId);
            case 'recent_sales':
            case 'penjualan_7_hari':
                return await this.getRecentSales(tenantId);

            // ✅ WhatsApp AI & Customer
            case 'ai_analytics':
            case 'performa_bot':
                return await this.getAIAnalytics(tenantId);
            case 'customer_metrics':
            case 'analisis_pelanggan':
                return await this.getCustomerMetrics(tenantId);
            case 'operational_metrics':
            case 'efisiensi_chat':
                return await this.getOperationalMetrics(tenantId);

            default:
                return "Maaf kak, jenis report tersebut belum tersedia. 🙏\n\nCoba ketik 'menu report' untuk lihat daftar laporan yang bisa saya buatkan.";
        }
    }

    // ==================== SALES & REVENUE REPORTS ====================

    private static async getSalesReport(tenantId: string): Promise<string> {
        const sold = await prisma.vehicle.findMany({
            where: { tenantId, status: 'SOLD' },
            orderBy: { updatedAt: 'desc' },
            take: 5
        });

        const totalCount = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });
        const totalValue = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'SOLD' },
            _sum: { price: true }
        });

        let msg = `📊 *LAPORAN PENJUALAN LENGKAP*\n\n`;
        msg += `📈 Total Unit Terjual: ${totalCount}\n`;
        msg += `💰 Total Revenue: Rp ${formatCurrency(totalValue._sum.price || 0)}\n\n`;

        if (sold.length > 0) {
            msg += `*5 Penjualan Terakhir:*\n`;
            sold.forEach((v, i) => {
                msg += `${i + 1}. ${v.make} ${v.model} (${v.year}) - Rp ${formatCurrency(v.price || 0)}\n`;
            });
        }

        msg += `\n🔗 *Detail Lengkap:* https://primamobil.id/dashboard/invoices`;
        return msg;
    }

    private static async getTotalSales(tenantId: string): Promise<string> {
        const count = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });
        return `📈 *TOTAL PENJUALAN*\n\nHingga saat ini, sebanyak *${count} unit* kendaraan telah terjual.\n\n🔗 *Lihat Chart:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
    }

    private static async getTotalRevenue(tenantId: string): Promise<string> {
        const stats = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'SOLD' },
            _sum: { price: true }
        });
        return `💰 *TOTAL PENDAPATAN*\n\nAkumulasi pendapatan dari unit terjual: \n*Rp ${formatCurrency(stats._sum.price || 0)}*\n\n🔗 *Detail Keuangan:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
    }

    private static async getSalesTrends(tenantId: string): Promise<string> {
        // Simplified trend: this month vs last month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const countThisMonth = await prisma.vehicle.count({
            where: { tenantId, status: 'SOLD', updatedAt: { gte: startOfMonth } }
        });

        const countPrevMonth = await prisma.vehicle.count({
            where: { tenantId, status: 'SOLD', updatedAt: { gte: startOfPrevMonth, lt: startOfMonth } }
        });

        const diff = countThisMonth - countPrevMonth;
        const trendIcon = diff >= 0 ? '📈' : '📉';
        const status = diff >= 0 ? 'naik' : 'turun';

        return `${trendIcon} *TREN PENJUALAN*\n\nBulan ini: *${countThisMonth} unit*\nBulan lalu: *${countPrevMonth} unit*\n\nTren ${status} sebesar *${Math.abs(diff)} unit* dibanding bulan lalu.\n\n🔗 *Grafik Tren:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
    }

    private static async getSalesMetrics(tenantId: string): Promise<string> {
        const totalSold = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });
        const totalLeads = await prisma.lead.count({ where: { tenantId } });
        const convRate = totalLeads > 0 ? ((totalSold / totalLeads) * 100).toFixed(1) : '0';

        return `🎯 *METRIK PENJUALAN (KPI)*\n\nTotal Leads: ${totalLeads}\nTotal Sales: ${totalSold}\nLead-to-Sale Conversion: *${convRate}%*\n\n🔗 *KPI Lengkap:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
    }

    private static async getSalesSummary(tenantId: string): Promise<string> {
        const totalRev = await prisma.vehicle.aggregate({ where: { tenantId, status: 'SOLD' }, _sum: { price: true } });
        const totalStock = await prisma.vehicle.count({ where: { tenantId, status: 'AVAILABLE' } });

        return `📝 *RINGKASAN CEPAT*\n\n💰 Revenue: Rp ${formatCurrency(totalRev._sum.price || 0)}\n📦 Stok Aktif: ${totalStock} unit\n\n🔗 *Dashboard Utama:* https://primamobil.id/dashboard`;
    }

    // ==================== INVENTORY & STOCK REPORTS ====================

    private static async getTotalInventory(tenantId: string): Promise<string> {
        const total = await prisma.vehicle.count({ where: { tenantId, status: 'AVAILABLE' } });
        const value = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'AVAILABLE' },
            _sum: { price: true }
        });

        return `📦 *LAPORAN STOK KESELURUHAN*\n\nUnit Tersedia: *${total} unit*\nTotal Nilai Aset: *Rp ${formatCurrency(value._sum.price || 0)}*\n\n🔗 *Inventory:* https://primamobil.id/dashboard/vehicles`;
    }

    private static async getVehicleListing(tenantId: string): Promise<string> {
        const vehicles = await prisma.vehicle.findMany({
            where: { tenantId, status: 'AVAILABLE' },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        let msg = `🚗 *DAFTAR KENDARAAN TERBARU*\n\n`;
        vehicles.forEach((v, i) => {
            msg += `${i + 1}. ${v.make} ${v.model} (${v.year}) - Rp ${formatCurrency(v.price || 0)}\n`;
        });

        msg += `\n🔗 *Lihat Semua:* https://primamobil.id/dashboard/vehicles`;
        return msg;
    }

    private static async getLowStockAlert(tenantId: string): Promise<string> {
        // Define low stock logic: brands with only 1 unit left
        const stockByMake = await prisma.vehicle.groupBy({
            by: ['make'],
            where: { tenantId, status: 'AVAILABLE' },
            _count: true
        });

        const lowStock = stockByMake.filter(s => s._count <= 1);

        if (lowStock.length === 0) {
            return `✅ *PERINGATAN STOK*\n\nSemua brand masih memiliki stok yang cukup safe.`;
        }

        let msg = `⚠️ *PERINGATAN STOK TIPIS*\n\nBeberapa brand tinggal 1 unit:\n`;
        lowStock.forEach(s => {
            msg += `• ${s.make}: ${s._count} unit\n`;
        });

        msg += `\n🔗 *Restock Sekarang:* https://primamobil.id/dashboard/vehicles`;
        return msg;
    }

    private static async getAveragePrice(tenantId: string): Promise<string> {
        const stats = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'AVAILABLE' },
            _avg: { price: true }
        });

        return `🧮 *ANALISIS RATA-RATA HARGA*\n\nRata-rata harga unit di showroom: \n*Rp ${formatCurrency(Math.floor(stats._avg.price || 0))}*\n\n🔗 *Detail Inventory:* https://primamobil.id/dashboard/vehicles`;
    }

    // ==================== TEAM & PERFORMANCE REPORTS ====================

    private static async getStaffPerformance(tenantId: string): Promise<string> {
        // Get top sales by unit count
        const topSales = await prisma.vehicle.groupBy({
            by: ['createdBy'],
            where: { tenantId, status: 'SOLD' },
            _count: true,
            orderBy: { _count: 'desc' },
            take: 5
        });

        if (topSales.length === 0) {
            return `👥 *PERFORMA SALES*\n\nBelum ada data penjualan tercatat.`;
        }

        let msg = `👥 *TOP PERFORMING SALES*\n\n`;
        for (const s of topSales) {
            const user = await prisma.user.findUnique({ where: { id: s.createdBy || '' }, select: { firstName: true, lastName: true } });
            const name = user ? `${user.firstName} ${user.lastName}` : 'System';
            msg += `• ${name}: ${s._count} unit terjual\n`;
        }

        msg += `\n🔗 *Detail Performa:* https://primamobil.id/dashboard/users`;
        return msg;
    }

    private static async getRecentSales(tenantId: string): Promise<string> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const count = await prisma.vehicle.count({
            where: { tenantId, status: 'SOLD', updatedAt: { gte: sevenDaysAgo } }
        });

        return `📅 *PENJUALAN 7 HARI TERAKHIR*\n\nBerhasil menjual *${count} unit* dalam 7 hari terakhir. 🔥\n\n🔗 *Daftar Invoices:* https://primamobil.id/dashboard/invoices`;
    }

    // ==================== WHATSAPP AI & CUSTOMER REPORTS ====================

    private static async getAIAnalytics(tenantId: string): Promise<string> {
        const totalConv = await prisma.whatsAppConversation.count({ where: { tenantId } });
        const totalMsgs = await prisma.whatsAppMessage.count({
            where: { conversation: { tenantId } }
        });

        return `🤖 *WHATSAPP AI ANALYTICS*\n\nPercakapan Masuk: ${totalConv}\nTotal Pesan Diproses: ${totalMsgs}\n\n🔗 *Full Analytics:* https://primamobil.id/dashboard/whatsapp-ai/analytics`;
    }

    private static async getCustomerMetrics(tenantId: string): Promise<string> {
        const totalCust = await prisma.whatsAppConversation.count({ where: { tenantId } });
        const leads = await prisma.lead.count({ where: { tenantId } });

        return `👥 *METRIK PELANGGAN*\n\nUnique Visitors: ${totalCust}\nConverted to Leads: ${leads}\n\n🔗 *Customer Data:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=whatsapp`;
    }

    private static async getOperationalMetrics(tenantId: string): Promise<string> {
        const totalMsgs = await prisma.whatsAppMessage.count({ where: { conversation: { tenantId } } });
        const aiMsgs = await prisma.whatsAppMessage.count({ where: { conversation: { tenantId }, direction: 'outbound' } });

        const efficiency = totalMsgs > 0 ? ((aiMsgs / totalMsgs) * 100).toFixed(1) : '0';

        return `⚙️ *METRIK OPERASIONAL*\n\nAI Handling Rate: *${efficiency}%*\n(Pesan dibalas bot vs total interaksi)\n\n🔗 *Detail Efisiensi:* https://primamobil.id/dashboard/whatsapp-ai/analytics`;
    }
}
