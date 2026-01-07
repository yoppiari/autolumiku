import { ReportData } from './comprehensive-report-pdf';

export class InsightEngine {
    static generate(data: ReportData): string[] {
        const insights: string[] = [];

        // 1. Inventory Analysis
        if (data.inventoryDetail && data.inventoryDetail.length > 0) {
            const lowStock = data.inventoryDetail.filter(v => v.daysInStock > 90);
            if (lowStock.length > 0) {
                insights.push(`Stok Lama: Ada ${lowStock.length} unit yang sudah mengendap lebih dari 3 bulan. Pertimbangkan program diskon atau cuci gudang.`);
            }

            const highValue = [...data.inventoryDetail].sort((a, b) => b.price - a.price).slice(0, 5);
            if (highValue.length > 0) {
                insights.push(`Aset Utama: ${highValue.length} unit termahal Anda bernilai total ${this.formatRupiah(highValue.reduce((sum, v) => sum + v.price, 0))}. Pastikan unit ini mendapat prioritas marketing.`);
            }
        }

        // 2. Sales Analysis
        if (data.totalSales !== undefined && data.totalSales > 0) {
            if (data.avgPrice && data.avgPrice < 150000000) {
                insights.push(`Segmentasi: Harga rata-rata penjualan Anda (${this.formatRupiah(data.avgPrice)}) berada di segmen entry-level. Anda bisa mencoba menambah stok unit middle-range (150jt-250jt) untuk meningkatkan margin.`);
            } else if (data.avgPrice && data.avgPrice > 250000000) {
                insights.push(`Segmentasi: Fokus Anda pada unit premium sangat baik. Pastikan layanan after-sales dan showroom experience sebanding dengan harga unit.`);
            }

            if (data.salesByBrand && data.salesByBrand.length > 0) {
                const topBrand = data.salesByBrand[0];
                insights.push(`Best Seller: Brand ${topBrand.brand} adalah penyumbang unit terbanyak (${topBrand.count} unit). Pertimbangkan untuk memperbanyak stok brand ini.`);
            }
        }

        // 3. WhatsApp & Engagement
        if (data.whatsapp) {
            if (data.whatsapp.aiResponseRate < 70) {
                insights.push(`Efisiensi Balasan: AI hanya menangani ${data.whatsapp.aiResponseRate}% pesan. Cek kembali konfigurasi AI atau tambahkan informasi kendaraan agar AI lebih pintar menjawab.`);
            }

            if (data.whatsapp.escalationRate > 30) {
                insights.push(`Beban Staff: Tingkat eskalasi ke staff cukup tinggi (${data.whatsapp.escalationRate}%). Ini menandakan customer butuh interaksi manusia yang intens, pastikan team sales responsif.`);
            }

            const priceInquiry = data.whatsapp.intentBreakdown?.find(i => (i.intent === 'price' || i.intent === 'harga'));
            if (priceInquiry && priceInquiry.percentage > 40) {
                insights.push(`Minat Harga: ${priceInquiry.percentage}% customer menanyakan harga. Pastikan harga di platform online selalu update dan kompetitif.`);
            }
        }

        // 4. Staff Performance
        if (data.staffPerformance && data.staffPerformance.length > 0) {
            const needsImprovement = data.staffPerformance.filter(s => s.performance === 'Needs Improvement');
            if (needsImprovement.length > 0) {
                insights.push(`SDM: Ada ${needsImprovement.length} staff dengan performa rendah bulan ini. Pertimbangkan sesi coaching atau review target.`);
            }
        }

        // 5. Lead & Customer Base
        if (data.totalLeads !== undefined && data.totalLeads > 0) {
            const conversion = data.totalSales ? Math.round((data.totalSales / data.totalLeads) * 100) : 0;
            if (conversion < 5) {
                insights.push(`Konversi Lead: Tingkat konversi Anda rendah (${conversion}%). Evaluasi cara staff sales menangani database leads.`);
            } else if (conversion > 15) {
                insights.push(`Konversi Lead: Performa konversi sangat baik (${conversion}%). Pertimbangkan untuk meningkatkan budget marketing untuk mendatangkan lebih banyak leads.`);
            }
        }

        if (data.totalCustomers !== undefined && data.totalCustomers > 100) {
            insights.push(`Basis Pelanggan: Anda memiliki ${data.totalCustomers} pelanggan terdaftar. Pertimbangkan program loyalitas atau promo khusus pelanggan lama.`);
        }

        // 6. Strategic Growth & Demand
        if (data.salesByBrand && data.salesByBrand.length > 0 && data.totalSales && data.totalSales >= 3) {
            const topBrand = data.salesByBrand[0];
            const marketShare = Math.round((topBrand.count / data.totalSales) * 100);
            if (marketShare > 40) {
                insights.push(`Dominasi Stok: Brand ${topBrand.brand} mendominasi ${marketShare}% penjualan Anda. Strategi beli: prioritaskan unit ${topBrand.brand} tahun muda untuk perputaran dana lebih cepat.`);
            }
        }

        // 7. Lead Quality & ROI
        if (data.totalLeads && data.totalLeads > 0 && data.totalRevenue) {
            const revPerLead = data.totalRevenue / data.totalLeads;
            if (revPerLead > 5000000) {
                insights.push(`Nilai Prospek: Setiap lead bernilai rata-rata ${this.formatRupiah(revPerLead)}. Investasi iklan di Meta/Google Ads sangat disarankan untuk menjaring lebih banyak lead berkualitas.`);
            }
        }

        // 8. Operational Bottleneck
        if (data.whatsapp && data.whatsapp.totalConversations > 20 && data.whatsapp.activeConversations > (data.whatsapp.totalConversations * 0.4)) {
            insights.push(`Bottleneck Operasional: Ada ${data.whatsapp.activeConversations} percakapan yang masih 'Active' (menggantung). Pastikan staff segera menyapa dan menutup diskusi agar konversi tidak hilang.`);
        }

        // Generic Fallback
        if (insights.length === 0) {
            insights.push("Basis Perhitungan: Menggunakan data 30 hari terakhir. Performa saat ini terpantau stabil, terus pantau dashboard untuk tren harian.");
        }

        return insights;
    }

    private static formatRupiah(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    }
}
