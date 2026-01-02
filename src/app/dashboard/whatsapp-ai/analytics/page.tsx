/**
 * WhatsApp AI Analytics Dashboard
 * Access: ADMIN (90+) only
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_LEVELS } from '@/lib/rbac';

type Department = 'sales' | 'whatsapp';

const intentColors: Record<string, string> = {
  vehicle: '#3b82f6', // blue
  price: '#8b5cf6',   // purple
  greeting: '#22c55e', // green
  general: '#f59e0b',  // amber
  escalated: '#ef4444' // red
};

interface KPIData {
  penjualanShowroom: number;
  atv: number;
  inventoryTurnover: number;
  customerRetention: number;
  nps: number;
  salesPerEmployee: number;
  efficiency: number;
  raw: {
    totalSold: number;
    totalInventory: number;
    totalRevenue: number;
    avgPrice: number;
    employeeCount: number;
    leadConversion: number;
  };
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  avgPrice: number;
  topBrands: { brand: string; count: number; revenue: number }[];
  monthlySales: { month: string; count: number; revenue: number; brands: { brand: string; count: number }[] }[];
  topPerformers: { name: string; sales: number; revenue: number }[];
}

interface WhatsAppAnalytics {
  overview: {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    aiResponseRate: number;
    avgResponseTime: number;
    escalationRate: number;
  };
  performance: {
    aiAccuracy: number;
    customerSatisfaction: number;
    resolutionRate: number;
    firstResponseTime: number;
  };
  timeSeriesData: {
    date: string;
    conversations: number;
    messages: number;
    escalations: number;
  }[];
  intentBreakdown: {
    intent: string;
    count: number;
    percentage: number;
  }[];
  staffActivity: {
    staffPhone: string;
    commandCount: number;
    successRate: number;
    lastActive: string;
  }[];
}

function AnalyticsPageInternal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDepartment, setActiveDepartment] = useState<Department>('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [whatsappAnalytics, setWhatsappAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['sales', 'whatsapp'].includes(tab)) {
      setActiveDepartment(tab as Department);
    }
  }, [searchParams]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      loadAnalytics();
      loadInsights(user.tenantId);
    }
  }, []);

  const loadInsights = async (tid: string) => {
    try {
      const res = await fetch(`/api/v1/reports/management-insights?period=monthly&tenantId=${tid}`);
      const data = await res.json();
      if (data.managementInsights) {
        setInsights(data.managementInsights.slice(0, 3));
      }
    } catch (e) {
      console.error('Failed to load insights:', e);
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;

      const salesRes = await fetch('/api/v1/analytics/sales', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSalesStats(salesData.data);
      }

      const kpiRes = await fetch('/api/v1/analytics/kpi', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (kpiRes.ok) {
        const kpiResult = await kpiRes.json();
        setKpiData(kpiResult.data);
      }

      if (parsedUser?.tenantId) {
        const waRes = await fetch(`/api/v1/whatsapp-ai/analytics?tenantId=${parsedUser.tenantId}&range=${timeRange}`);
        if (waRes.ok) {
          const waData = await waRes.json();
          if (waData.success) setWhatsappAnalytics(waData.data);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-6 pb-20">
      {/* Header */}
      {/* Header - Elegant Rich Modern (Matched to Main Dashboard) */}
      <div className="mb-6">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-6 py-3 md:py-4 shadow-lg">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard/whatsapp-ai" className="text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1">
                ← Back to WhatsApp AI
              </Link>
            </div>
            <h1 className="text-base md:text-2xl font-bold text-white truncate">
              Sales & Analytics Report
            </h1>
            <p className="text-xs md:text-sm text-slate-300">Laporan performa & analisis showroom</p>
          </div>
          <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 ml-2 flex-shrink-0">
            <span className="w-1.5 md:w-2 h-1.5 md:h-2 bg-emerald-400 rounded-full mr-1 md:mr-2 animate-pulse"></span>
            Live Data
          </span>
        </div>
      </div>

      {/* Department Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeDepartment === 'sales'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-lg">📊</span>
            <span>Sales Report</span>
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeDepartment === 'whatsapp'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-lg">💬</span>
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
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="space-y-6">
            {/* Summary Cards - Main Dashboard Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-xs md:text-sm text-gray-500">Total Penjualan</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{salesStats?.totalSales || 0}</p>
                <p className="text-[10px] md:text-xs text-green-600 mt-1">Unit terjual</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-xs md:text-sm text-gray-500">Total Revenue</p>
                <p className="text-xl md:text-2xl font-bold text-blue-600">{formatRupiah(salesStats?.totalRevenue || 0)}</p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1">Omzet keseluruhan</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-xs md:text-sm text-gray-500">Total Inventory</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{kpiData?.raw.totalInventory || 0}</p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1">Stok tersedia</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:shadow-md transition-shadow border border-gray-100">
                <p className="text-xs md:text-sm text-gray-500">Top Brand</p>
                <p className="text-xl md:text-2xl font-bold text-purple-600 truncate">{salesStats?.topBrands?.[0]?.brand || '-'}</p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1">{salesStats?.topBrands?.[0]?.count || 0} unit</p>
              </div>
            </div>

            {/* Analysis Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-l-4 border-blue-600 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">📋</span>
                <h4 className="text-sm font-bold text-blue-900 uppercase">Executive Analysis</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-xs text-blue-800 leading-relaxed">
                  <span className="font-bold">Performa Penjualan:</span> {(salesStats?.totalSales || 0) >= 5 ? 'Status stabil dengan volume penjualan yang sehat.' : 'Perlu perhatian khusus pada strategi leads & pricing.'}
                </div>
                <div className="text-xs text-blue-800 leading-relaxed">
                  <span className="font-bold">Inventory Strategy:</span> Turnover rate saat ini di level {kpiData?.inventoryTurnover || 0}%. Target optimal adalah 20% unit terjual per bulan.
                </div>
              </div>
            </div>

            {/* KPI Charts Section - Matched to Main Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* KPI Penjualan */}
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col">
                <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-lg">📊</span> Metrix Penjualan
                </h4>
                <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                  <div className="relative w-28 h-28 md:w-32 md:h-32">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3.5"
                        strokeDasharray={`${kpiData?.penjualanShowroom || 0} ${100 - (kpiData?.penjualanShowroom || 0)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl md:text-3xl font-bold text-blue-600">{kpiData?.penjualanShowroom || 0}%</span>
                      <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">Monthly Target</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2 border-t border-gray-100 pt-2 md:pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">ATV</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.atv || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-purple-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Inventory Turnover</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                  </div>
                </div>
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                  <p className="text-[7px] md:text-[8px] leading-snug text-blue-500">
                    Target: 20% inventory sold per month
                  </p>
                </div>
              </div>

              {/* KPI Pelanggan */}
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col">
                <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-lg">👥</span> Metrix Pelanggan
                </h4>
                <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                  <div className="relative w-28 h-28 md:w-32 md:h-32">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeDasharray={`${kpiData?.nps || 0} ${100 - (kpiData?.nps || 0)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl md:text-3xl font-bold text-amber-600">{kpiData?.nps || 0}%</span>
                      <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">NPS Score</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2 border-t border-gray-100 pt-2 md:pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-teal-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Customer Retention</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.customerRetention || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-cyan-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Lead Conversion</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.raw?.leadConversion || 0}%</span>
                  </div>
                </div>
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                  <p className="text-[7px] md:text-[8px] leading-snug text-amber-500">
                    Target: NPS &gt; 50% (Excellent)
                  </p>
                </div>
              </div>

              {/* KPI Operasional */}
              <div className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col">
                <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-lg">⚙️</span> Metrix Operasional
                </h4>
                <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                  <div className="relative w-28 h-28 md:w-32 md:h-32">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3.5"
                        strokeDasharray={`${kpiData?.efficiency || 0} ${100 - (kpiData?.efficiency || 0)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl md:text-3xl font-bold text-violet-600">{kpiData?.efficiency || 0}%</span>
                      <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">Efficiency</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 md:space-y-2 border-t border-gray-100 pt-2 md:pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-indigo-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Sales per Employee</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.salesPerEmployee || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-rose-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Inventory Velocity</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                  </div>
                </div>
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                  <p className="text-[7px] md:text-[8px] leading-snug text-violet-500">
                    Target: 2 vehicles/employee/month
                  </p>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Report Categories Grid */}
          <section className="pt-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-6 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">📂</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Laporan Tersedia</h3>
                    <p className="text-xs text-gray-500">Pilih kategori laporan untuk melihat detail analisis</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 shadow-sm">
                    15 TOTAL REPORTS
                  </span>
                </div>
              </div>

              <div className="p-4 md:p-8 space-y-12">
                {/* Sales & Revenue */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">💰</span>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Sales Revenue Semua</h3>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">6 REPORTS</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { id: 'one-page-sales', name: 'Sales & Revenue Report', desc: 'Metrik keuangan & brand distribution (1 Hal)', icon: '💰', href: '/dashboard/whatsapp-ai/analytics/reports/one-page-sales' },
                      { id: 'total-sales', name: 'Total Penjualan', desc: 'Data akumulasi unit terjual & volume', icon: '📊', href: '/dashboard/whatsapp-ai/analytics/reports/total-sales' },
                      { id: 'sales-trends', name: 'Tren Penjualan Bulanan', desc: 'Analisis pertumbuhan penjualan harian', icon: '📈', href: '/dashboard/whatsapp-ai/analytics/reports/sales-trends' },
                      { id: 'sales-summary', name: 'Sales Executive Summary', desc: 'Ringkasan performa untuk management', icon: '📋', href: '/dashboard/whatsapp-ai/analytics/reports/sales-summary' },
                      { id: 'sales-metrics', name: 'Metrik Penjualan', desc: 'KPI Penjualan, ATV & Turnover', icon: '📐', href: '/dashboard/whatsapp-ai/analytics/reports/sales-metrics' },
                      { id: 'sales-report', name: 'Laporan Penjualan Lengkap', desc: 'Full data dump & detail transaksi', icon: '📑', href: '/dashboard/whatsapp-ai/analytics/reports/sales-report' },
                    ].map(report => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* Inventory & Stock */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">📦</span>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Inventory & Stock Reports</h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">4 REPORTS</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { id: 'total-inventory', name: 'Stock Report (Total)', desc: 'Ringkasan stok kendaraan tersedia', icon: '📦', href: '/dashboard/whatsapp-ai/analytics/reports/total-inventory' },
                      { id: 'low-stock-alert', name: 'Low Stock Alert', desc: 'Peringatan stok kritis & stok lama', icon: '⚠️', href: '/dashboard/whatsapp-ai/analytics/reports/low-stock-alert' },
                      { id: 'average-price', name: 'Rata-rata Harga (Avg)', desc: 'Analisis harga jual vs harga stok', icon: '💵', href: '/dashboard/whatsapp-ai/analytics/reports/average-price' },
                      { id: 'inventory-listing', name: 'Vehicle Inventory Listing', desc: 'Katalog stok lengkap dengan foto', icon: '🚙', href: '/dashboard/whatsapp-ai/analytics/reports/inventory-listing' },
                    ].map(report => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* Team & Performance */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">🏆</span>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Team & Performance</h3>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">2 REPORTS</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { id: 'staff-performance', name: 'Performa Staff', desc: 'Ranking & produktivitas tim sales', icon: '🏆', href: '/dashboard/whatsapp-ai/analytics/reports/staff-performance' },
                      { id: 'recent-sales', name: 'Penjualan Terkini', desc: 'Aktivitas transaksi terbaru', icon: '🔄', href: '/dashboard/whatsapp-ai/analytics/reports/recent-sales' },
                    ].map(report => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* WhatsApp AI & Engagement */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">🤖</span>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">WhatsApp AI & Engagement</h3>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">3 REPORTS</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { id: 'whatsapp-ai', name: 'WhatsApp AI Analytics', desc: 'Efektivitas bot & interaksi pelanggan', icon: '🤖', href: '/dashboard/whatsapp-ai/analytics/reports/whatsapp-ai' },
                      { id: 'operational-metrics', name: 'Metrik Operasional AI', desc: 'Response time & resolution rate', icon: '⚙️', href: '/dashboard/whatsapp-ai/analytics/reports/operational-metrics' },
                      { id: 'customer-metrics', name: 'Metrik Pelanggan', desc: 'Analisis ketertarikan & behavior', icon: '👥', href: '/dashboard/whatsapp-ai/analytics/reports/customer-metrics' },
                    ].map(report => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* WhatsApp AI Tab Content */}
      {!isLoading && activeDepartment === 'whatsapp' && (
        <div className="space-y-6 animate-in fade-in duration-500">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Conversations</p>
                  <p className="text-2xl font-bold text-gray-900">{whatsappAnalytics.overview.totalConversations}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">Messages Handled</p>
                  <p className="text-2xl font-bold text-blue-600">{whatsappAnalytics.overview.totalMessages}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">AI Response Rate</p>
                  <p className="text-2xl font-bold text-green-600">{whatsappAnalytics.overview.aiResponseRate}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">Escalation Rate</p>
                  <p className="text-2xl font-bold text-red-600">{whatsappAnalytics.overview.escalationRate}%</p>
                </div>
              </div>

              {/* Performance Analysis Card */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">🤖</span>
                  <h4 className="text-lg font-bold text-gray-900">AI Performance Analysis</h4>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: { id: string; name: string; desc: string; icon: string; href?: string } }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow group flex flex-col justify-between h-full">
      <div>
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-blue-50 transition-colors">
          {report.icon}
        </div>
        <h4 className="text-base font-bold text-gray-900 mb-2">{report.name}</h4>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed line-clamp-2">{report.desc}</p>
      </div>

      {report.href ? (
        <Link
          href={report.href}
          className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm transition-all"
        >
          <span>View Report</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      ) : (
        <button disabled className="w-full py-2.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-400 cursor-not-allowed">
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
