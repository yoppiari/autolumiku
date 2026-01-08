'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useSearchParams } from 'next/navigation';

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  topBrands: { brand: string; count: number }[];
}

interface KPIData {
  raw: any;
  penjualanShowroom: number;
  atv: number;
  inventoryTurnover: number;
  efficiency: number;
  nps: number;
  customerRetention: number;
  leadConversion: number;
  salesPerEmployee: number;
}

interface WhatsappAnalytics {
  overview: {
    totalConversations: number;
    totalMessages: number;
    aiResponseRate: number;
    escalationRate: number;
    avgResponseTime: number;
  };
  performance: {
    resolutionRate: number;
    aiAccuracy: number;
  };
  intentBreakdown: { intent: string; count: number; percentage: number }[];
}

const intentColors: Record<string, string> = {
  'vehicle_search': '#3b82f6',
  'price_inquiry': '#10b981',
  'test_drive': '#f59e0b',
  'support': '#8b5cf6',
  'other': '#6b7280'
};

function AnalyticsPageInternal() {
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tid = searchParams?.get('tenantId');
    if (tid) {
      setTenantId(tid);
    } else {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.tenantId) setTenantId(user.tenantId);
          else setIsLoading(false);
        } catch (e) {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
  }, [searchParams]);

  const [activeDepartment, setActiveDepartment] = useState<'sales' | 'whatsapp'>('sales');
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [whatsappAnalytics, setWhatsappAnalytics] = useState<WhatsappAnalytics | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [salesRes, kpiRes, waRes] = await Promise.all([
        api.get(`/api/v1/analytics/sales?tenantId=${tenantId}`),
        api.get(`/api/v1/analytics/kpi?tenantId=${tenantId}`),
        api.get(`/api/v1/whatsapp-ai/analytics?tenantId=${tenantId}`)
      ]);

      if (salesRes.success) setSalesStats(salesRes.data);
      if (kpiRes.success) setKpiData(kpiRes.data);
      if (waRes.success) setWhatsappAnalytics(waRes.data);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId, loadData]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-5 py-2 md:py-3 shadow-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-[10px] flex items-center gap-1">
                ← Dashboard Utama
              </Link>
            </div>
            <h1 className="text-sm md:text-xl font-bold text-white truncate leading-tight">
              Sales & Analytics Report
            </h1>
            <p className="text-[10px] md:text-sm text-slate-300">Laporan performa & analisis showroom</p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 ml-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse"></span>
            Live Data
          </span>
        </div>
      </div>

      {/* Department Tabs */}
      <div className="border-b border-gray-200 mb-2">
        <nav className="flex gap-2" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`py-2 px-3 border-b-2 font-medium text-xs flex items-center gap-2 whitespace-nowrap ${activeDepartment === 'sales'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-base">📊</span>
            <span>Laporan Penjualan</span>
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-2 px-3 border-b-2 font-medium text-xs flex items-center gap-2 whitespace-nowrap ${activeDepartment === 'whatsapp'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-base">💬</span>
            <span>WhatsApp AI</span>
          </button>
        </nav>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Sales Report Tab Content */}
      {!isLoading && activeDepartment === 'sales' && (
        <div className="space-y-2 animate-in fade-in duration-500">
          <div className="space-y-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-2 md:p-3 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-[10px] md:text-xs text-gray-500">Total Penjualan</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 leading-tight">{salesStats?.totalSales || 0}</p>
                <p className="text-[9px] text-green-600 mt-0.5">Unit terjual (Bulan ini)</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-2 md:p-3 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-[10px] md:text-xs text-gray-500">Total Revenue</p>
                <p className="text-lg md:text-xl font-bold text-blue-600 leading-tight">{formatRupiah(salesStats?.totalRevenue || 0)}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">Omzet</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-2 md:p-3 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-[10px] md:text-xs text-gray-500">Total Inventory</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 leading-tight">{kpiData?.raw?.totalInventory || 0}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">Stok tersedia</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-2 md:p-3 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-[10px] md:text-xs text-gray-500">Top Brand</p>
                <p className="text-lg md:text-xl font-bold text-purple-600 truncate leading-tight">{salesStats?.topBrands?.[0]?.brand || '-'}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{salesStats?.topBrands?.[0]?.count || 0} unit</p>
              </div>
            </div>

            {/* Analysis Summary */}
            <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-indigo-700 to-blue-600 px-4 py-3 flex items-center gap-3">
                <span className="text-xl bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">📋</span>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Executive Analysis</h4>
                  <p className="text-[10px] text-indigo-100 opacity-80">AI-powered business insight & recommendations</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Analysis Menyeluruh */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-900">
                      <span className="text-lg">🔍</span>
                      <h5 className="text-xs font-bold uppercase">Analysis Menyeluruh</h5>
                    </div>
                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-50">
                      <p className="text-[11px] text-indigo-800 leading-relaxed">
                        {(salesStats?.totalSales || 0) === 0 ? (
                          <>
                            <span className="font-bold text-red-600">Performa Kritis:</span> Belum ada unit terjual dalam periode ini. Strategi penjualan perlu ditinjau ulang segera untuk menggerakkan stok yang ada.
                          </>
                        ) : (salesStats?.totalSales || 0) < 5 ? (
                          <>
                            <span className="font-bold text-amber-600">Perlu Perhatian:</span> Penjualan mulai berjalan namun masih di bawah target bulanan. Fokus pada peningkatan volume penjualan unit entry-level.
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-emerald-600">Performa Stable:</span> Volume penjualan menunjukkan tren positif. Pastikan ketersediaan stok untuk model-model terlaris terjaga.
                          </>
                        )}
                        {" "}Brand terpopuler saat ini adalah <span className="font-bold text-indigo-900">{salesStats?.topBrands?.[0]?.brand || 'belum teridentifikasi'}</span>.
                      </p>
                    </div>
                  </div>

                  {/* Review Kekurangan */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-900">
                      <span className="text-lg">📉</span>
                      <h5 className="text-xs font-bold uppercase">Review Kekurangan</h5>
                    </div>
                    <div className="bg-red-50/50 rounded-xl p-3 border border-red-50">
                      <p className="text-[11px] text-red-800 leading-relaxed">
                        <span className="font-bold">Indikator Lemah:</span>
                        <ul className="list-disc ml-4 mt-1 space-y-1">
                          {(kpiData?.inventoryTurnover || 0) < 20 && (
                            <li>Turnover stok ({kpiData?.inventoryTurnover || 0}%) jauh di bawah target optimal 20%.</li>
                          )}
                          {(kpiData?.leadConversion || 0) < 15 && (
                            <li>Konversi leads ke penjualan ({kpiData?.leadConversion || 0}%) masih belum optimal.</li>
                          )}
                          {(salesStats?.totalSales || 0) === 0 && (
                            <li>Zero Sales Velocity: Stok tidak bergerak dalam 30 hari terakhir.</li>
                          )}
                        </ul>
                      </p>
                    </div>
                  </div>

                  {/* Saran & Strategi */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-900">
                      <span className="text-lg">🚀</span>
                      <h5 className="text-xs font-bold uppercase">Saran & Strategi</h5>
                    </div>
                    <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-50">
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        <span className="font-bold">Rekomendasi Owner:</span>
                        <ul className="list-disc ml-4 mt-1 space-y-1">
                          <li>Prioritaskan "Clearance Sale" untuk stok lama guna mencapai target <span className="font-bold">Turnover 20%</span>.</li>
                          <li>Optimalkan follow-up otomatis via WhatsApp AI untuk meningkatkan konversi.</li>
                          <li>Tingkatkan promosi digital pada brand <span className="font-bold">{salesStats?.topBrands?.[0]?.brand || 'High-Demand'}</span>.</li>
                        </ul>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* KPI Penjualan */}
              <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200 flex flex-col items-center">
                <h4 className="text-xs font-bold text-gray-800 mb-2 self-start w-full">📊 Metrix Penjualan</h4>
                <div className="relative w-24 h-24 mb-2">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeDasharray={`${kpiData?.penjualanShowroom || 0} ${100 - (kpiData?.penjualanShowroom || 0)}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-blue-600">{kpiData?.penjualanShowroom || 0}%</span>
                    <span className="text-[8px] text-gray-600 font-medium">Target Bulanan</span>
                  </div>
                </div>
                <div className="w-full space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="text-gray-600">ATV</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.atv || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      <span className="text-gray-600">Turnover</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="text-gray-600">Showroom</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.penjualanShowroom || 0}%</span>
                  </div>
                </div>
              </div>

              {/* KPI Pelanggan */}
              <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200 flex flex-col items-center">
                <h4 className="text-xs font-bold text-gray-800 mb-2 self-start w-full">👥 Metrix Pelanggan</h4>
                <div className="relative w-24 h-24 mb-2">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray={`${kpiData?.nps || 0} ${100 - (kpiData?.nps || 0)}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-amber-600">{kpiData?.nps || 0}%</span>
                    <span className="text-[8px] text-gray-600 font-medium">NPS Score</span>
                  </div>
                </div>
                <div className="w-full space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                      <span className="text-gray-600">Retention</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.customerRetention || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span className="text-gray-600">NPS Score</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.nps || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      <span className="text-gray-600">Conversion</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.leadConversion || 0}%</span>
                  </div>
                </div>
              </div>

              {/* KPI Operasional */}
              <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200 flex flex-col items-center">
                <h4 className="text-xs font-bold text-gray-800 mb-2 self-start w-full">⚙️ Metrix Operasional</h4>
                <div className="relative w-24 h-24 mb-2">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#8b5cf6" strokeWidth="3.5" strokeDasharray={`${kpiData?.efficiency || 0} ${100 - (kpiData?.efficiency || 0)}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-violet-600">{kpiData?.efficiency || 0}%</span>
                    <span className="text-[8px] text-gray-600 font-medium">Efficiency</span>
                  </div>
                </div>
                <div className="w-full space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span className="text-gray-600">Sales/Emp</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.salesPerEmployee || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                      <span className="text-gray-600">Efficiency</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.efficiency || 0}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span className="text-gray-600">Velocity</span>
                    </div>
                    <span className="font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Report Categories Grid */}
          <section className="pt-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-2 md:p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📂</span>
                  <h3 className="text-sm font-bold text-gray-900">Laporan Tersedia</h3>
                </div>
                <span className="px-2 py-0.5 bg-white border rounded-full text-[10px] font-bold text-gray-500">9 REPORTS</span>
              </div>

              <div className="p-3 md:p-5 space-y-5">
                {/* Sales & Revenue */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💰</span>
                    <h3 className="text-xs font-bold text-gray-800 uppercase">Penjualan & Pendapatan</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { id: 'sales-report', name: 'Laporan Penjualan', desc: 'Laporan lengkap detail transaksi', icon: '📑', href: '/dashboard/whatsapp-ai/analytics/reports/sales-report' },
                      { id: 'one-page-sales', name: 'Total Pendapatan', desc: 'Ringkasan pendapatan total & ATV', icon: '💰', href: '/dashboard/whatsapp-ai/analytics/reports/one-page-sales' },
                      { id: 'sales-trends', name: 'Tren Penjualan', desc: 'Analisis pertumbuhan dibanding bulan lalu', icon: '📈', href: '/dashboard/whatsapp-ai/analytics/reports/sales-trends' },
                      { id: 'sales-metrics', name: 'Metrik Penjualan', desc: 'KPI konversi leads ke penjualan', icon: '📐', href: '/dashboard/whatsapp-ai/analytics/reports/sales-metrics' },
                      { id: 'sales-summary', name: 'Ringkasan Penjualan', desc: 'Ringkasan eksekutif performa showroom', icon: '📋', href: '/dashboard/whatsapp-ai/analytics/reports/sales-summary' },
                    ].map(report => <ReportCard key={report.id} report={report} />)}
                  </div>
                </section>

                {/* Inventory & Stock */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📦</span>
                    <h3 className="text-xs font-bold text-gray-800 uppercase">Inventori & Stok</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { id: 'total-inventory', name: 'Total Inventori', desc: 'Laporan stok keseluruhan & aset', icon: '📦', href: '/dashboard/whatsapp-ai/analytics/reports/total-inventory' },
                      { id: 'inventory-listing', name: 'Daftar Kendaraan', desc: 'Katalog kendaraan terbaru', icon: '🚙', href: '/dashboard/whatsapp-ai/analytics/reports/inventory-listing' },
                      { id: 'low-stock-alert', name: 'Peringatan Stok', desc: 'Peringatan otomatis stok menipis', icon: '⚠️', href: '/dashboard/whatsapp-ai/analytics/reports/low-stock-alert' },
                      { id: 'average-price', name: 'Rata-rata Harga', desc: 'Analisis harga stok vs terjual', icon: '💵', href: '/dashboard/whatsapp-ai/analytics/reports/average-price' },
                    ].map(report => <ReportCard key={report.id} report={report} />)}
                  </div>
                </section>

                {/* Team & Performance */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏆</span>
                    <h3 className="text-xs font-bold text-gray-800 uppercase">Tim & Performa</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { id: 'staff-performance', name: 'Performa Staff', desc: 'Ranking performa individual sales', icon: '🏆', href: '/dashboard/whatsapp-ai/analytics/reports/staff-performance' },
                    ].map(report => <ReportCard key={report.id} report={report} />)}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* WhatsApp AI Tab Content */}
      {!isLoading && activeDepartment === 'whatsapp' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {!whatsappAnalytics ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-yellow-800 font-medium mb-4">Setup WhatsApp AI terlebih dahulu.</p>
              <Link href="/dashboard/whatsapp-ai/setup" className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Setup WhatsApp AI →
              </Link>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Conversations</p>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{whatsappAnalytics.overview.totalConversations}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Messages Handled</p>
                  <p className="text-xl font-bold text-blue-600 leading-tight">{whatsappAnalytics.overview.totalMessages}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">AI Response Rate</p>
                  <p className="text-xl font-bold text-green-600 leading-tight">{whatsappAnalytics.overview.aiResponseRate}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Escalation Rate</p>
                  <p className="text-xl font-bold text-red-600 leading-tight">{whatsappAnalytics.overview.escalationRate}%</p>
                </div>
              </div>

              {/* Performance Analysis Card */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🤖</span>
                  <h4 className="text-base font-bold text-gray-900">AI Performance Analysis</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col items-center">
                    <p className="text-sm text-gray-600 mb-4 font-medium">Intent Distribution</p>
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        {whatsappAnalytics.intentBreakdown?.map((item, idx) => {
                          let offset = 0;
                          for (let i = 0; i < idx; i++) offset += whatsappAnalytics.intentBreakdown[i].percentage;
                          return (
                            <circle
                              key={idx}
                              cx="18" cy="18" r="15.9155"
                              fill="none"
                              stroke={intentColors[item.intent.toLowerCase()] || '#cbd5e1'}
                              strokeWidth="4"
                              strokeDasharray={`${item.percentage} ${100 - item.percentage}`}
                              strokeDashoffset={-offset}
                              transform="rotate(-90 18 18)"
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-3xl font-bold text-gray-800">{whatsappAnalytics.performance.aiAccuracy}%</span>
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Accuracy</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold mb-1 uppercase">Top Business Intent</p>
                      <p className="text-xl font-bold text-gray-900">{whatsappAnalytics.intentBreakdown?.[0]?.intent || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold mb-1 uppercase">Avg Response Time</p>
                      <p className="text-xl font-bold text-gray-900">{whatsappAnalytics.overview.avgResponseTime}s</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold mb-1 uppercase">Success Resolution</p>
                      <p className="text-xl font-bold text-gray-900">{whatsappAnalytics.performance.resolutionRate}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp AI Reports Grid */}
              <section className="pt-1">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-2 md:p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📂</span>
                      <h3 className="text-sm font-bold text-gray-900">Laporan Tersedia</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-white border rounded-full text-[10px] font-bold text-gray-500">4 REPORTS</span>
                  </div>

                  <div className="p-3 md:p-5 space-y-5">
                    {/* WhatsApp AI & Engagement */}
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🤖</span>
                        <h3 className="text-xs font-bold text-gray-800 uppercase">WhatsApp AI</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          { id: 'whatsapp-ai', name: 'Analisis WhatsApp AI', desc: 'Akurasi bot & tingkat penanganan otomatis', icon: '🤖', href: '/dashboard/whatsapp-ai/analytics/reports/whatsapp-ai' },
                          { id: 'customer-metrics', name: 'Metrik Pelanggan', desc: 'Analisis perilaku pelanggan & penyelesaian', icon: '👥', href: '/dashboard/whatsapp-ai/analytics/reports/customer-metrics' },
                          { id: 'operational-metrics', name: 'Metrik Operasional', desc: 'Efisiensi chat bot vs manual', icon: '⚙️', href: '/dashboard/whatsapp-ai/analytics/reports/operational-metrics' },
                          { id: 'whatsapp-chat', name: 'WhatsApp AI', desc: 'Monitor percakapan AI secara real-time', icon: '💬', href: '/dashboard/whatsapp-ai' },
                        ].map(report => <ReportCard key={report.id} report={report} />)}
                      </div>
                    </section>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: { id: string; name: string; desc: string; icon: string; href?: string } }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 hover:shadow-md transition-shadow group flex flex-col justify-between h-full">
      <div className="mb-2">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-lg flex items-center justify-center text-lg mb-2 group-hover:bg-blue-50 transition-colors">
          {report.icon}
        </div>
        <h4 className="text-xs md:text-sm font-bold text-gray-900 mb-1">{report.name}</h4>
        <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">{report.desc}</p>
      </div>

      {report.href ? (
        <Link
          href={report.href}
          className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm transition-all"
        >
          <span>View Report</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      ) : (
        <button disabled className="w-full py-1.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-400 cursor-not-allowed">
          Coming Soon
        </button>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AnalyticsPageInternal />
    </Suspense>
  );
}
