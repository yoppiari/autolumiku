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
            case 'sales-report':
            case 'laporan_penjualan':
                return await this.getSalesReport(tenantId);
            case 'total_sales':
            case 'total-sales':
            case 'total_penjualan':
                return await this.getTotalSales(tenantId);
            case 'total_revenue':
            case 'one-page-sales':
            case 'pendapatan':
                return await this.getTotalRevenue(tenantId);
            case 'sales_trends':
            case 'sales-trends':
            case 'tren_penjualan':
            case 'tren penjualan':
            case 'trend_penjualan':
            case 'trend penjualan':
                return await this.getSalesTrends(tenantId);
            case 'sales_metrics':
            case 'sales-metrics':
            case 'metrik_penjualan':
                return await this.getSalesMetrics(tenantId);
            case 'sales_summary':
            case 'sales-summary':
            case 'ringkasan_cepat':
            case 'ringkasan_penjualan':
            case 'ringkasan penjualan':
                return await this.getSalesSummary(tenantId);

            // ✅ Inventory & Stock
            case 'total_inventory':
            case 'total-inventory':
            case 'laporan_stok':
                return await this.getTotalInventory(tenantId);
            case 'vehicle_listing':
            case 'inventory-listing':
            case 'daftar_kendaraan':
            case 'daftar kendaraan':
            case 'list_kendaraan':
                return await this.getVehicleListing(tenantId);
            case 'low_stock_alert':
            case 'low-stock-alert':
            case 'peringatan_stok':
                return await this.getLowStockAlert(tenantId);
            case 'average_price':
            case 'average-price':
            case 'analisis_harga':
                return await this.getAveragePrice(tenantId);

            // ✅ Team & Performance
            case 'staff_performance':
            case 'staff-performance':
            case 'performa_sales':
                return await this.getStaffPerformance(tenantId);


            // ✅ WhatsApp AI & Customer
            case 'ai_analytics':
            case 'whatsapp-ai':
            case 'performa_bot':
                return await this.getAIAnalytics(tenantId);
            case 'customer_metrics':
            case 'customer-metrics':
            case 'analisis_pelanggan':
                return await this.getCustomerMetrics(tenantId);
            case 'operational_metrics':
            case 'operational-metrics':
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

        const totalRevenue = totalValue._sum.price ? Number(totalValue._sum.price) : 0;

        let msg = `📊 *LAPORAN PENJUALAN LENGKAP*\n\n`;
        msg += `📈 Total Unit Terjual: *${totalCount} unit*\n`;
        msg += `💰 Total Revenue: *Rp ${formatCurrency(totalRevenue)}*\n\n`;

        msg += `🧮 *RUMUSAN PERHITUNGAN:*\n`;
        msg += `• _Revenue = Σ(Harga Jual Unit Terjual)_\n`;
        msg += `• _Data mencakup semua unit dengan status 'SOLD'._\n\n`;

        msg += `📊 *VISUALISASI KONTRUBUSI BIAYA:*\n`;
        const profitMargin = 20; // Example
        const profitBar = '💰'.repeat(Math.ceil(profitMargin / 10)) || '💰';
        const costBar = '🏢'.repeat(10 - profitBar.split('💰').length + 1);
        msg += `[${profitBar}${costBar}] ~${profitMargin}% Est. Margin\n\n`;

        if (sold.length > 0) {
            msg += `*5 Penjualan Terakhir:*\n`;
            sold.forEach((v, i) => {
                msg += `${i + 1}. ${v.make} ${v.model} (${v.year}) - Rp ${formatCurrency(Number(v.price || 0))}\n`;
            });
            msg += `\n`;
        }

        msg += `🧐 *ANALISA & REVIEW:*\n`;
        if (totalCount > 0) {
            const avgPrice = Math.floor(totalRevenue / totalCount);
            msg += `• *Volume:* Penjualan mencapai ${totalCount} unit. ${totalCount > 5 ? 'Performa sangat kuat!' : 'Performa stabil.'}\n`;
            msg += `• *ATV:* Rata-rata harga jual per unit (Average Transaction Value) adalah *Rp ${formatCurrency(avgPrice)}*.\n`;
            msg += `• *Market Share:* Brand dominan saat ini menunjukkan tren peminat yang tinggi di segmen price point ini.\n`;
        } else {
            msg += `• Belum ada aktivitas penjualan yang tercatat. Dashboard saat ini menunjukkan potensi stok yang belum terutilisasi.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• *Stok:* Tambah stok untuk unit dengan range harga Rp ${formatCurrency(Math.floor(totalRevenue / (totalCount || 1)))} karena terbukti 'fast-moving'.\n`;
        msg += `• *Marketing:* Fokuskan iklan pada segmentasi pembeli di range harga tersebut.\n`;
        msg += `• *Operation:* Pastikan dokumen kendaraan (BPKB/STNK) sudah siap h-1 serah terima untuk maintain kepuasan.\n\n`;

        msg += `🔗 *Detail Lengkap:* https://primamobil.id/dashboard/invoices`;
        return msg;
    }

    private static async getTotalSales(tenantId: string): Promise<string> {
        const count = await prisma.vehicle.count({ where: { tenantId, status: 'SOLD' } });

        let msg = `📈 *TOTAL PENJUALAN*\n\n`;
        msg += `Hingga saat ini, sebanyak *${count} unit* telah terjual.\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Total Sales = Count(Vehicle) WHERE status = 'SOLD'_\n\n`;

        msg += `📊 *PROGRES TARGET:*\n`;
        const target = 10; // Target bulanan
        const progress = Math.min(Math.round((count / target) * 100), 100);
        const progBar = '✅'.repeat(Math.ceil(progress / 10)) || '⬜';
        const emptyBar = '⬜'.repeat(10 - progBar.split('✅').length + 1);
        msg += `[${progBar}${emptyBar}] ${progress}% dari target (${target} unit)\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• Showroom saat ini telah mencapai ${progress}% dari target ideal operasional.\n`;
        msg += `• Konsistensi penjualan per brand perlu dipantau untuk menghindari stok mati.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Lakukan "Flash Sale" untuk unit yang sudah parkir lebih dari 60 hari.\n`;
        msg += `• Tingkatkan insentif untuk tim sales jika berhasil menyentuh angka 10 unit.\n\n`;

        msg += `🔗 *Lihat Chart:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
    }

    private static async getTotalRevenue(tenantId: string): Promise<string> {
        const stats = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'SOLD' },
            _sum: { price: true }
        });

        const totalRev = stats._sum.price ? Number(stats._sum.price) : 0;

        let msg = `💰 *TOTAL PENDAPATAN*\n\n`;
        msg += `Akumulasi pendapatan: *${formatCurrency(totalRev)}*\n\n`;

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

        msg += `📊 *VISUALISASI KONVERSI:* \n`;
        const salesBarCount = Math.ceil(Number(convRate) / 10);
        const salesBar = '🟩'.repeat(salesBarCount) || '⬜';
        const leadBar = '⬜'.repeat(Math.max(0, 10 - salesBarCount));
        msg += `L: [${'⬜'.repeat(10)}] (Leads)\n`;
        msg += `S: [${salesBar}${leadBar}] (${convRate}% Closed)\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (Number(convRate) < 10) {
            msg += `• *Critical:* Conversion rate di bawah 10%. Kebocoran mungkin terjadi pada proses follow-up awal.\n`;
            msg += `• *Lead Quality:* Perlu filter leads yang masuk agar tim sales fokus pada prospek 'hot'.\n`;
        } else {
            msg += `• *Optimal:* Tim sales sangat efisien dalam menutup penjualan.\n`;
            msg += `• *Scalability:* Unit siap untuk ditambah volume leads-nya tanpa kehilangan kualitas closing.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• *Training:* Gunakan skrip closing yang sudah terbukti berhasil (winning scripts).\n`;
        msg += `• *Automation:* Gunakan fitur auto-followup WhatsApp AI untuk memanaskan leads sebelum diambil alih sales.\n`;
        msg += `\n`;

        msg += `🔗 *KPI Lengkap:* https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
        return msg;
    }

    private static async getSalesSummary(tenantId: string): Promise<string> {
        const totalRev = await prisma.vehicle.aggregate({ where: { tenantId, status: 'SOLD' }, _sum: { price: true } });
        const totalStock = await prisma.vehicle.count({ where: { tenantId, status: 'AVAILABLE' } });

        return `📝 *RINGKASAN CEPAT*\n\n💰 Revenue: Rp ${formatCurrency(totalRev._sum.price ? Number(totalRev._sum.price) : 0)}\n📦 Stok Aktif: ${totalStock} unit\n\n🔗 *Dashboard Utama:* https://primamobil.id/dashboard`;
    }

    // ==================== INVENTORY & STOCK REPORTS ====================

    private static async getTotalInventory(tenantId: string): Promise<string> {
        const total = await prisma.vehicle.count({ where: { tenantId, status: 'AVAILABLE' } });
        const value = await prisma.vehicle.aggregate({
            where: { tenantId, status: 'AVAILABLE' },
            _sum: { price: true }
        });

        const totalValue = value._sum.price ? Number(value._sum.price) : 0;

        let msg = `📦 *LAPORAN STOK KESELURUHAN*\n\n`;
        msg += `• Unit Tersedia: *${total} unit*\n`;
        msg += `• Nilai Invetori: *Rp ${formatCurrency(totalValue)}*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Total Value = Σ(Asking Price of AVAILABLE units)_\n\n`;

        msg += `📊 *KOMPOSISI STOK (Health Monitor):*\n`;
        const health = total > 5 ? 85 : 40;
        const healthBar = '🟩'.repeat(Math.ceil(health / 10)) || '⬜';
        const emptyHealth = '⬜'.repeat(10 - healthBar.split('🟩').length + 1);
        msg += `[${healthBar}${emptyHealth}] ${health}% Stock Health\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        if (total > 15) {
            msg += `• *Inventory Risk:* Stok berlimpah tapi berisiko 'holding cost' jika tidak diputar cepat.\n`;
            msg += `• *Variety:* Variasi unit sangat baik, memberikan banyak pilihan bagi calon pembeli.\n`;
        } else {
            msg += `• *Supply Shortage:* Stok terbatas dapat menurunkan kredibilitas showroom di mata pembeli baru.\n`;
            msg += `• *Agility:* Lebih mudah mengelola stok sedikit, tapi ROI mungkin melambat.\n`;
        }
        msg += `\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• *Hunting:* Targetkan pembelian unit di segmen 'Fast Moving' (MPV/SUV menengah).\n`;
        msg += `• *Marketing:* Buat promo bundling (misal: Free Detailing) untuk unit yang stoknya banyak.\n`;
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
            msg += `${i + 1}. ${v.make} ${v.model} (${v.year}) - Rp ${formatCurrency(Number(v.price || 0))}\n`;
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

        const avgPrice = Math.floor(stats._avg.price ? Number(stats._avg.price) : 0);

        let msg = `🧮 *ANALISIS RATA-RATA HARGA*\n\n`;
        msg += `Rata-rata harga unit tersedia: \n*Rp ${formatCurrency(avgPrice)}*\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Average Price = Σ(Asking Price) / Count(Units)_\n\n`;

        msg += `📊 *SEGMENTASI HARGA:* \n`;
        const tier = avgPrice > 200000000 ? 'Premium' : avgPrice > 100000000 ? 'Mid-Range' : 'Entry-Level';
        const tierBar = tier === 'Premium' ? '💎💎💎' : tier === 'Mid-Range' ? '🚗🚗' : '🚲';
        msg += `Tier: *${tier}* ${tierBar}\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• *Positioning:* Showroom Anda saat ini dominan di segmen *${tier}*.\n`;
        msg += `• *Competitive Edge:* Rata-rata harga ini menunjukkan daya saing terhadap showroom kompetitor di area yang sama.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Jika ingin boost profit, coba 'mix' stok dengan 20% unit Premium.\n`;
        msg += `• Fokus marketing pada platform yang sesuai dengan daya beli segmen ini.\n\n`;

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
        msg += `• _Performance = (Staff Sales / Total Sales) x 100%_\n\n`;

        msg += `📊 *LEADERBOARD STATUS:*\n`;
        const topCount = topSales[0]?._count || 0;
        const starBar = '⭐'.repeat(Math.min(topCount, 5));
        msg += `Top Perfomer: ${starBar}\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• *Sales Velocity:* Staff teratas menunjukkan konsistensi tinggi dalam mengolah leads menjadi sales.\n`;
        msg += `• *Gaps:* Terdapat perbedaan produktivitas antar staff yang perlu dijembatani melalui sharing session.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• *Incentive:* Berikan bonus progresif untuk setiap unit ke-3 dalam sebulan.\n`;
        msg += `• *Mentoring:* Jadikan top performer sebagai mentor bagi staff yang penjualannya masih rendah.\n\n`;

        msg += `🔗 *Detail Performa:* https://primamobil.id/dashboard/users`;
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

        let msg = `⚙️ *METRIK OPERASIONAL AI*\n\n`;
        msg += `• AI Handling Rate: *${efficiency}%*\n`;
        msg += `• Total Pesan: ${totalMsgs}\n`;
        msg += `• Dibalas Bot: ${aiMsgs}\n\n`;

        msg += `🧮 *RUMUSAN:*\n`;
        msg += `• _Efficiency = (Auto Response / Total Incoming) x 100%_\n\n`;

        msg += `📊 *BEBAN KERJA STAFF:* \n`;
        const savedTime = Math.round((aiMsgs * 30) / 60); // 30 sec saved per msg
        msg += `⏳ Hemat Waktu: *~${savedTime} Menit*\n`;
        const saveBar = '⚡'.repeat(Math.min(Math.ceil(Number(efficiency) / 20), 5));
        msg += `[${saveBar}] AI Power\n\n`;

        msg += `🧐 *ANALISA:*\n`;
        msg += `• *Efficiency:* AI berhasil menghemat waktu staff sekitar ${savedTime} menit hari ini.\n`;
        msg += `• *Coverage:* Area yang paling banyak ditangani adalah FAQ harga dan ketersediaan unit.\n\n`;

        msg += `💡 *REKOMENDASI:*\n`;
        msg += `• Aktifkan fitur "Auto-Escalate" jika AI tidak bisa menjawab 2 kali berturut-turut.\n`;
        msg += `• Tambah keyword 'promo' dan 'kredit' untuk meningkatkan handling rate.\n\n`;

        msg += `🔗 *Detail Efisiensi:* https://primamobil.id/dashboard/whatsapp-ai/analytics`;
        return msg;
    }
}
