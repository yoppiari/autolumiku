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

        const totalRevenue = totalValue._sum.price || 0;

        let msg = `📊 *LAPORAN PENJUALAN LENGKAP*\n\n`;
        msg += `📈 Total Unit Terjual: *${totalCount} unit*\n`;
        msg += `💰 Total Revenue: *Rp ${formatCurrency(totalRevenue)}*\n\n`;

        msg += `🧮 *RUMUSAN PERHITUNGAN:*\n`;
        msg += `• _Revenue = Σ(Harga Jual Unit Terjual)_\n`;
        msg += `• _Data mencakup semua unit dengan status 'SOLD'._\n\n`;

        if (sold.length > 0) {
            msg += `*5 Penjualan Terakhir:*\n`;
            sold.forEach((v, i) => {
                msg += `${i + 1}. ${v.make} ${v.model} (${v.year}) - Rp ${formatCurrency(v.price || 0)}\n`;
            });
            msg += `\n`;
        }

        msg += `🧐 *ANALISA & REVIEW:*\n`;
        if (totalCount > 0) {
            const avgPrice = Math.floor(totalRevenue / totalCount);
            msg += `• Rata-rata harga jual (ATV) berada di angka *Rp ${formatCurrency(avgPrice)}*.\n`;
            msg += `• Perputaran stok terlihat ${totalCount > 2 ? 'stabil' : 'perlu ditingkatkan'}.\n`;
        } else {
            msg += `• Belum ada aktivitas penjualan yang tercatat.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Pertahankan momentum dengan mempromosikan unit 'Available' yang serupa.\n`;
        msg += `• Update status 'Sold' segera setelah transaksi selesai agar data tetap akurat.\n\n`;

        msg += `🔗 *Detail Lengkap:* https://primamobil.id/dashboard/invoices`;
        return msg;
    }

    private static async getTotalSales(tenantId: string): Promise<string> {
        const count = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });

        let msg = `📈 *TOTAL PENJUALAN*\n\n`;
        msg += `Hingga saat ini, sebanyak *${count} unit* telah terjual.\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Count(Vehicle) WHERE status = 'SOLD'_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Volume penjualan ini mencerminkan penetrasi pasar showroom Anda.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Analisa brand yang paling cepat laku untuk strategi stok berikutnya.\n\n`;

        msg += `🔗 *Lihat Chart:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
    }

    private static async getTotalRevenue(tenantId: string): Promise<string> {
        const stats = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'SOLD' },
            _sum: { price: true }
        });

        const totalRev = stats._sum.price || 0;

        let msg = `💰 *TOTAL PENDAPATAN*\n\n`;
        msg += `Akumulasi pendapatan: *Rp ${formatCurrency(totalRev)}*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Total Revenue = SUM(Final Sale Price)_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Omzet kumulatif ini adalah hasil dari seluruh unit yang telah berstatus SOLD.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Pastikan margin profit terjaga di setiap unit yang terjual.\n\n`;

        msg += `🔗 *Detail Keuangan:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
    }

    private static async getSalesTrends(tenantId: string): Promise<string> {
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
        const status = diff >= 0 ? 'NAIK' : 'TURUN';

        let msg = `${trendIcon} *TREN PENJUALAN*\n\n`;
        msg += `• Bulan ini: *${countThisMonth} unit*\n`;
        msg += `• Bulan lalu: *${countPrevMonth} unit*\n`;
        msg += `• Status: *${status} ${Math.abs(diff)} unit*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Trend = (Jualan Bulan Ini) - (Jualan Bulan Lalu)_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (diff > 0) {
            msg += `• Performa bulan ini menunjukkan tren positif dibanding bulan sebelumnya.\n`;
        } else if (diff < 0) {
            msg += `• Ada penurunan volume penjualan. Perlu evaluasi strategi promosi.\n`;
        } else {
            msg += `• Volume penjualan stabil (sama dengan bulan lalu).\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += diff < 0 ? `• Tingkatkan intensitas follow-up leads yang pending.\n` : `• Pertahankan kualitas layanan agar tren terus meningkat.\n`;
        msg += `\n`;

        msg += `🔗 *Grafik Tren:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
    }

    private static async getSalesMetrics(tenantId: string): Promise<string> {
        const totalSold = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });
        const totalLeads = await prisma.lead.count({ where: { tenantId } });
        const convRate = totalLeads > 0 ? ((totalSold / totalLeads) * 100).toFixed(1) : '0';

        let msg = `🎯 *METRIK PENJUALAN (KPI)*\n\n`;
        msg += `• Total Leads: ${totalLeads}\n`;
        msg += `• Total Sales: ${totalSold}\n`;
        msg += `• Conversion: *${convRate}%*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Conv. Rate = (Total Sales / Total Leads) x 100%_\n\n`;

        msg += `🔴 *PIE CHART (Sales vs Leads)*\n`;
        const salesBar = '🟩'.repeat(Math.ceil(Number(convRate) / 10)) || '⬜';
        const leadBar = '⬜'.repeat(10 - salesBar.split('🟩').length + 1);
        msg += `[${salesBar}${leadBar}] ${convRate}% Close Rate\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (Number(convRate) < 10) {
            msg += `• Rasio konversi masih rendah (< 10%). Masalah mungkin ada di respons tim sales atau kualitas leads.\n`;
        } else {
            msg += `• Rasio konversi bagus! Efektivitas sales dalam menutup prospek sudah optimal.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += Number(convRate) < 10 ? `• Berikan training teknik closing pada staff sales.\n` : `• Skalakan jumlah leads untuk memperbesar volume penjualan.\n`;
        msg += `\n`;

        msg += `🔗 *KPI Lengkap:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
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

        const totalValue = value._sum.price || 0;

        let msg = `📦 *LAPORAN STOK KESELURUHAN*\n\n`;
        msg += `• Unit Tersedia: *${total} unit*\n`;
        msg += `• Nilai Invetori: *Rp ${formatCurrency(totalValue)}*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Total Value = Σ(Asking Price of AVAILABLE units)_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (total > 15) {
            msg += `• Stok berlimpah. Pastikan kecepatan rotasi barang (inventory turnover) terjaga.\n`;
        } else {
            msg += `• Stok menipis. Segera lakukan hunting unit baru untuk menjaga variasi showroom.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += total > 15 ? `• Buat promo paket "Cuci Gudang" untuk unit yang sudah lama parkir.\n` : `• Fokus pada penambahan stok brand yang paling dicari (Fast Moving).\n`;
        msg += `\n`;

        msg += `🔗 *Inventory:* https://primamobil.id/dashboard/vehicles`;
        return msg;
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

        msg += `\n🧮 *RUMUSAN:*\n`;
        msg += `• _List(Vehicle) WHERE status = 'AVAILABLE' ORDER BY createdAt DESC_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Unit di atas adalah stok terbaru yang siap dipasarkan.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Segera buat konten video/foto untuk unit terbaru agar cepat menarik minat leads.\n\n`;

        msg += `🔗 *Lihat Semua:* https://primamobil.id/dashboard/vehicles`;
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

        const avgPrice = Math.floor(stats._avg.price || 0);

        let msg = `🧮 *ANALISIS RATA-RATA HARGA*\n\n`;
        msg += `Rata-rata harga unit tersedia: \n*Rp ${formatCurrency(avgPrice)}*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Average Price = AVG(Price of AVAILABLE units)_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Angka ini menunjukkan segmentasi harga showroom Anda (Low, Mid, atau Premium).\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Sesuaikan budget marketing dengan target audiens dari segmen harga ini.\n\n`;

        msg += `🔗 *Detail Inventory:* https://primamobil.id/dashboard/vehicles`;
        return msg;
    }

    // ==================== TEAM & PERFORMANCE REPORTS ====================

    private static async getStaffPerformance(tenantId: string): Promise<string> {
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
            msg += `• ${name}: ${s._count} unit\n`;
        }

        msg += `\n🧮 *RUMUSAN:*\n`;
        msg += `• _Ranked by COUNT(Vehicle) WHERE status = 'SOLD'_\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Data ini menunjukkan kontribusi masing-masing staff terhadap total sales.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Berikan apresiasi (insentif) bagi top performer untuk menjaga motivasi.\n\n`;

        msg += `🔗 *Detail Performa:* https://primamobil.id/dashboard/users`;
        return msg;
    }

    private static async getRecentSales(tenantId: string): Promise<string> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const count = await prisma.vehicle.count({
            where: { tenantId, status: 'SOLD', updatedAt: { gte: sevenDaysAgo } }
        });

        let msg = `📅 *PENJUALAN 7 HARI TERAKHIR*\n\n`;
        msg += `Berhasil menjual *${count} unit* 🔥\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (count > 0) {
            msg += `• Aktivitas penjualan dalam seminggu terakhir cukup aktif.\n`;
        } else {
            msg += `• Tidak ada penjualan dalam 7 hari terakhir. Perlu push promosi.\n`;
        }
        msg += `\n`;

        msg += `🔗 *Daftar Invoices:* https://primamobil.id/dashboard/invoices`;
        return msg;
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
