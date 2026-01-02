/**
 * WhatsApp AI Analytics Dashboard
 * Includes: Sales Department, Finance/Accounting, and WhatsApp AI metrics
 * Access: ADMIN (90+) only
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_LEVELS } from '@/lib/rbac';

type Department = 'sales' | 'whatsapp';


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
  const [accessDenied, setAccessDenied] = useState(false);
  const [userRoleLevel, setUserRoleLevel] = useState(ROLE_LEVELS.SALES);
  const [activeDepartment, setActiveDepartment] = useState<Department>('sales');
  const [isLoading, setIsLoading] = useState(true);

  // Handle URL query params for tab switching
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['sales', 'whatsapp'].includes(tab)) {
      setActiveDepartment(tab as Department);
    }
  }, [searchParams]);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [whatsappAnalytics, setWhatsappAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  // Access guard: ADMIN (90+) only
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const roleLevel = user.roleLevel || ROLE_LEVELS.SALES;
      setUserRoleLevel(roleLevel);

      loadAnalytics();
      loadInsights(user.tenantId);
    }
  }, [router]);

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

      // Load sales stats
      const salesRes = await fetch('/api/v1/analytics/sales', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSalesStats(salesData.data);
      }

      // Load KPI data (real calculations)
      const kpiRes = await fetch('/api/v1/analytics/kpi', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (kpiRes.ok) {
        const kpiResult = await kpiRes.json();
        setKpiData(kpiResult.data);
      }

      // Load WhatsApp analytics
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

  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadReport = async (reportId: string) => {
    alert('Fitur download PDF telah dinonaktifkan. Silakan lihat detail laporan langsung di dashboard ini.');
    return;
    /* PDF DOWNLOAD DISABLED
    try {
      setDownloading(reportId);
// ... existing logic commented out ...
    } finally {
      setDownloading(null);
    }
    */
  };


  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Intent colors for donut chart
  const intentColors: Record<string, string> = {
    greeting: '#22c55e',
    vehicle: '#3b82f6',
    price: '#a855f7',
    general: '#f59e0b',
    closing: '#ef4444',
    unknown: '#6b7280',
  };

  // No access restrictions for viewing
  if (false && accessDenied) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600">Halaman Analytics hanya untuk Manager ke atas.</p>
          <p className="text-sm text-gray-500 mt-2">Mengalihkan ke Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        {/* Back link - separate row on mobile */}
        <Link href="/dashboard/whatsapp-ai" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mb-2 md:mb-0">
          ← Back
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Laporan performa untuk manajemen Prima Mobil</p>
          </div>

          {/* Smart Insights Banner */}
          {insights.length > 0 && (
            <div className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-3 md:p-4 text-white shadow-md relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                <span className="text-8xl">🧠</span>
              </div>
              <div className="relative z-10">
                <h3 className="text-xs md:text-sm font-bold flex items-center gap-2 mb-2">
                  <span>🧠</span> SMART INSIGHTS
                </h3>
                <div className="space-y-1.5">
                  {insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] md:text-xs bg-white/10 rounded px-2 py-1 border border-white/5">
                      <span className="text-blue-300">•</span>
                      <p className="line-clamp-1">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Period Filter & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter - for Sales only */}
            {activeDepartment === 'sales' && (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="monthly">Bulanan</option>
                <option value="quarterly">Kuartalan</option>
                <option value="yearly">Tahunan</option>
              </select>
            )}
            {/* Time Range - for WhatsApp */}
            {activeDepartment === 'whatsapp' && (
              <div className="flex items-center gap-1">
                {['today', 'week', 'month'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as typeof timeRange)}
                    className={`px-3 py-2 rounded text-sm font-medium ${timeRange === range ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Tabs - Scrollable on mobile */}
      <div className="border-b border-gray-200 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
        <nav className="flex overflow-x-auto scrollbar-hide" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeDepartment === 'sales'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-lg">📊</span>
            <span className="hidden sm:inline">Sales Report</span>
            <span className="sm:hidden">Sales</span>
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeDepartment === 'whatsapp'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="text-lg">💬</span>
            <span className="hidden sm:inline">WhatsApp AI</span>
            <span className="sm:hidden">WhatsApp</span>
          </button>
        </nav>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 text-gray-600 text-sm">Memuat data analytics...</p>
          </div>
        </div>
      )}


      {/* Sales Department Report */}
      {!isLoading && activeDepartment === 'sales' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white rounded-lg shadow p-3 md:p-4">
              <p className="text-xs md:text-sm text-gray-500">Total Penjualan</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{salesStats?.totalSales || 0}</p>
              <p className="text-[10px] md:text-xs text-green-600 mt-1">Unit terjual</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 md:p-4">
              <p className="text-xs md:text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl md:text-2xl font-bold text-blue-600">{formatRupiah(salesStats?.totalRevenue || 0)}</p>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1">Omzet keseluruhan</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 md:p-4">
              <p className="text-xs md:text-sm text-gray-500">Total Inventory</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{kpiData?.raw.totalInventory || 0}</p>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1">Stok tersedia</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 md:p-4">
              <p className="text-xs md:text-sm text-gray-500">Top Brand</p>
              <p className="text-xl md:text-2xl font-bold text-purple-600">{salesStats?.topBrands?.[0]?.brand || '-'}</p>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1">{salesStats?.topBrands?.[0]?.count || 0} unit</p>
            </div>
          </div>

          {/* Chart Section - 3 Main KPI Metrics with indicators in list format */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI Penjualan */}
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-lg">📊</span> Metrix Penjualan
              </h4>

              {/* Main Donut Chart - Penjualan Showroom */}
              <div className="flex items-center justify-center py-3 mb-3">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
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
                    <span className="text-3xl font-bold text-blue-600">{kpiData?.penjualanShowroom || 0}%</span>
                    <span className="text-[10px] text-gray-600 font-medium">Target Bulanan</span>
                  </div>
                </div>
              </div>

              {/* Indicators List */}
              <div className="space-y-2.5 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                    <span className="text-xs text-gray-700 font-medium">ATV</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.atv || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Inventory Turnover</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Penjualan Showroom</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.penjualanShowroom || 0}%</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-[8px] leading-snug" style={{ color: '#3b82f6' }}>
                  Target: 20% inventory sold per month (2-5 vehicles)
                </p>
              </div>
            </div>

            {/* KPI Pelanggan */}
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-lg">👥</span> Metrix Pelanggan
              </h4>

              {/* Main Donut Chart - NPS (Net Promoter Score) */}
              <div className="flex items-center justify-center py-3 mb-3">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
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
                    <span className="text-3xl font-bold text-amber-600">{kpiData?.nps || 0}%</span>
                    <span className="text-[10px] text-gray-600 font-medium">NPS Score</span>
                  </div>
                </div>
              </div>

              {/* Indicators List */}
              <div className="space-y-2.5 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Customer Retention</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.customerRetention || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-xs text-gray-700 font-medium">NPS (Satisfaction)</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.nps || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Lead Conversion</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.raw?.leadConversion || 0}%</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-[8px] leading-snug" style={{ color: '#f59e0b' }}>
                  Target: NPS &gt; 50% (Excellent)
                </p>
              </div>
            </div>

            {/* KPI Operasional */}
            <div className="bg-white rounded-lg shadow p-5">
              <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-lg">⚙️</span> Metrix Operasional
              </h4>

              {/* Main Donut Chart - Overall Efficiency */}
              <div className="flex items-center justify-center py-3 mb-3">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
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
                    <span className="text-3xl font-bold text-violet-600">{kpiData?.efficiency || 0}%</span>
                    <span className="text-[10px] text-gray-600 font-medium">Efficiency</span>
                  </div>
                </div>
              </div>

              {/* Indicators List */}
              <div className="space-y-2.5 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Sales per Employee</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.salesPerEmployee || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Overall Efficiency</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.efficiency || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-xs text-gray-700 font-medium">Inventory Velocity</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-[8px] leading-snug" style={{ color: '#8b5cf6' }}>
                  Target: 2 vehicles/employee/month
                </p>
              </div>
            </div>
          </div>

          {/* Stacked Bar Chart: Monthly Sales by Brand */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 Tren Penjualan by Brand</h4>
            <p className="text-[10px] text-gray-500 mb-4">Monthly trend dengan breakdown brand (unit terjual)</p>

            <div className="h-56 flex items-end gap-2 px-2 md:px-4">
              {salesStats?.monthlySales && salesStats.monthlySales.length > 0 ? (
                (() => {
                  const maxCount = Math.max(...salesStats.monthlySales.map(m => m.count), 1);
                  const topBrands = salesStats.topBrands?.slice(0, 5) || [];
                  const brandColors: Record<string, string> = {
                    [topBrands[0]?.brand]: '#3b82f6', // blue
                    [topBrands[1]?.brand]: '#22c55e', // green
                    [topBrands[2]?.brand]: '#a855f7', // purple
                    [topBrands[3]?.brand]: '#f59e0b', // amber
                    [topBrands[4]?.brand]: '#ef4444', // red
                    'Other': '#6b7280', // gray
                  };

                  return salesStats.monthlySales.map((month, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] md:text-[10px] text-gray-600 font-semibold">{month.count}</span>
                      <div className="w-full flex flex-col-reverse" style={{ height: `${Math.max((month.count / maxCount) * 160, 20)}px` }}>
                        {/* Stacked bars - use actual brand breakdown from API */}
                        {month.brands && month.brands.length > 0 ? (
                          month.brands.map((brandInfo, bIdx) => {
                            const brandPercent = month.count > 0 ? (brandInfo.count / month.count) : 0;
                            const height = Math.max(5, (brandPercent * ((month.count / maxCount) * 160)));
                            return (
                              <div
                                key={bIdx}
                                className="w-full hover:opacity-80 transition-opacity"
                                style={{
                                  height: `${height}px`,
                                  backgroundColor: brandColors[brandInfo.brand] || '#6b7280',
                                }}
                                title={`${brandInfo.brand}: ${brandInfo.count} unit`}
                              />
                            );
                          })
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <span className="text-[8px] md:text-[9px] text-gray-500 truncate w-full text-center">
                        {month.month.includes('-')
                          ? new Date(month.month + (month.month.length === 7 ? '-01' : '')).toLocaleDateString('id-ID', { month: 'short' })
                          : month.month}
                      </span>
                    </div>
                  ));
                })()
              ) : (
                // Default empty stacked bars
                ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] md:text-[10px] text-gray-400">0</span>
                    <div className="w-full flex flex-col-reverse bg-gray-200 rounded-t" style={{ height: '20px' }}>
                      <div className="w-full h-1/3 bg-gray-300"></div>
                      <div className="w-full h-1/3 bg-gray-400"></div>
                      <div className="w-full h-1/3 bg-gray-500"></div>
                    </div>
                    <span className="text-[8px] md:text-[9px] text-gray-400">{month}</span>
                  </div>
                ))
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mt-4 pt-3 border-t border-gray-100">
              {salesStats?.topBrands?.slice(0, 5).map((brand, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444'][idx]
                    }}
                  ></span>
                  <span className="text-[9px] md:text-[10px] text-gray-600">{brand.brand} ({brand.count})</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                <span className="text-[9px] md:text-[10px] text-gray-600">Other</span>
              </div>
            </div>
          </div>

          {/* Staff Performance Summary */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 md:p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm md:text-base font-semibold text-gray-900 flex items-center gap-2">
                <span>👥</span> Staff Performance Summary
              </h3>
              <Link href="/dashboard/whatsapp-ai/analytics" className="text-[10px] md:text-xs text-blue-600 hover:text-blue-800 font-medium">
                View Full Activity →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-4 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">Staff Name</th>
                    <th className="px-3 md:px-4 py-2 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-3 md:px-4 py-2 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-3 md:px-4 py-2 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesStats?.topPerformers && salesStats.topPerformers.length > 0 ? (
                    salesStats.topPerformers.map((staff, idx) => {
                      const performance = staff.sales >= 5 ? 'Excellent' : staff.sales >= 3 ? 'Good' : 'Needs Improvement';
                      const perfColor = performance === 'Excellent' ? 'bg-green-100 text-green-800' : performance === 'Good' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 md:px-4 py-2 md:py-3 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900">{staff.name}</td>
                          <td className="px-3 md:px-4 py-2 md:py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-900 font-semibold">{staff.sales}</td>
                          <td className="px-3 md:px-4 py-2 md:py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-600">{formatRupiah(staff.revenue)}</td>
                          <td className="px-3 md:px-4 py-2 md:py-3 whitespace-nowrap text-xs md:text-sm text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${perfColor}`}>
                              {performance}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 md:px-4 py-6 md:py-8 text-center text-gray-500 text-xs md:text-sm">
                        Belum ada data penjualan bulan ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Management Analysis Footnotes - Smaller & Colorful */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-green-50 rounded-lg border-l-4 border-blue-500 p-3 md:p-4 shadow-sm">
            <h4 className="text-xs md:text-sm font-bold text-blue-900 uppercase tracking-wide mb-2 md:mb-2.5 flex items-center gap-2">
              <span className="text-base md:text-lg">📋</span>
              <span className="leading-tight">Analisis KPI Showroom</span>
              <span className="text-blue-600 font-normal mx-1">•</span>
              <span className="text-blue-700 font-semibold">Executive Summary</span>
            </h4>
            <div className="space-y-2">
              {/* Analysis Point 1 - Sales Performance */}
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-blue-700">📊 Performa Penjualan:</span>{' '}
                <span className="text-gray-700">
                  {(salesStats?.totalSales || 0) >= 10 ? (
                    <><span className="text-green-600 font-semibold">Excellent</span> - Melampaui target ({salesStats?.totalSales || 0} unit). Pertahankan momentum.</>
                  ) : (salesStats?.totalSales || 0) >= 5 ? (
                    <><span className="text-amber-600 font-semibold">Stabil</span> - {salesStats?.totalSales || 0} unit terjual. {10 - (salesStats?.totalSales || 0)} unit lagi untuk mencapai target ideal bulan ini.</>
                  ) : (
                    <><span className="text-red-600 font-semibold">Perlu Atensi</span> - {salesStats?.totalSales || 0} unit terjual. Tingkatkan intensitas follow-up leads dan review pricing stok.</>
                  )}
                </span>
              </div>

              {/* Analysis Point 2 - Brand Strategy */}
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-purple-700">🚗 Strategi Brand:</span>{' '}
                <span className="text-gray-700">
                  {salesStats?.topBrands && salesStats.topBrands.length > 0 ? (
                    <>{salesStats.topBrands[0].brand} dominan ({salesStats.topBrands[0].count} unit). {
                      salesStats.topBrands.length > 1
                        ? <span className="text-purple-600">Diversifikasi dengan {salesStats.topBrands[1]?.brand} untuk reduce risk.</span>
                        : <span className="text-amber-600">Perlu diversifikasi brand untuk reduce risk.</span>
                    }</>
                  ) : (
                    <span className="text-gray-500">Mulai tracking penjualan per brand.</span>
                  )}
                </span>
              </div>

              {/* Analysis Point 3 - Revenue Optimization */}
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-green-700">💰 Optimasi Revenue:</span>{' '}
                <span className="text-gray-700">
                  {(salesStats?.avgPrice || 0) > 200000000 ? (
                    <><span className="text-green-600 font-semibold">High ATV</span> - {formatRupiah(salesStats?.avgPrice || 0)}. Margin optimal, fokus segmen premium.</>
                  ) : (salesStats?.avgPrice || 0) > 100000000 ? (
                    <><span className="text-blue-600 font-semibold">Mid ATV</span> - {formatRupiah(salesStats?.avgPrice || 0)}. Upselling aksesoris untuk boost revenue.</>
                  ) : (
                    <><span className="text-amber-600 font-semibold">Low ATV</span> - {formatRupiah(salesStats?.avgPrice || 0)}. Evaluasi product mix & pricing.</>
                  )}
                </span>
              </div>

              {/* Analysis Point 4 - Action Items */}
              <div className="text-[10px] md:text-xs leading-snug border-t border-blue-200 pt-2 mt-2">
                <span className="font-bold text-rose-700">⚡ Rekomendasi Aksi:</span>{' '}
                <span className="text-gray-700">
                  <span className="text-blue-600 font-semibold">1)</span> Review target bulanan. {' '}
                  <span className="text-blue-600 font-semibold">2)</span> Evaluasi conversion rate. {' '}
                  <span className="text-blue-600 font-semibold">3)</span> Analisis kompetitor pricing. {' '}
                  <span className="text-blue-600 font-semibold">4)</span> Optimasi inventory.
                </span>
              </div>
            </div>

            {/* Footer timestamp */}
            <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between">
              <span className="text-[9px] md:text-[10px] text-blue-400/80 font-medium">
                Report: {period === 'monthly' ? 'Bulanan' : period === 'quarterly' ? 'Kuartalan' : 'Tahunan'} • Generated: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[9px] md:text-[10px] text-blue-400/80 font-semibold">Prima Mobil v2.0</span>
            </div>
          </div>


          {/* Consolidating 'Analytics & Report' here at the bottom of Sales Report */}
          <div className="pt-8 space-y-8 border-t border-gray-200 mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Detailed Reports & Analytics</h2>

            {/* Sales & Revenue Reports (6) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💰</span>
                <h3 className="text-lg font-bold text-gray-900">Sales & Revenue Reports</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">6 REPORTS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Inventory & Stock Reports (4) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📦</span>
                <h3 className="text-lg font-bold text-gray-900">Inventory & Stock Reports</h3>
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

            {/* Team & Performance (2) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🏆</span>
                <h3 className="text-lg font-bold text-gray-900">Team & Performance</h3>
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

            {/* WhatsApp AI & Engagement (3) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🤖</span>
                <h3 className="text-lg font-bold text-gray-900">WhatsApp AI & Engagement</h3>
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
      )}

      {/* WhatsApp AI Report */}
      {!isLoading && activeDepartment === 'whatsapp' && (
        <div className="space-y-6">
          {!whatsappAnalytics ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-yellow-800 text-sm mb-3">Setup WhatsApp AI terlebih dahulu.</p>
              <Link href="/dashboard/whatsapp-ai/setup" className="inline-block px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                Setup WhatsApp AI →
              </Link>
            </div>
          ) : (
            <>
              {/* Business Metrics Cards - Unique data only */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white rounded-lg shadow p-3 md:p-4">
                  <p className="text-xs md:text-sm text-gray-500">Conversations</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">{whatsappAnalytics.overview.totalConversations}</p>
                  <p className="text-[10px] md:text-xs text-green-600 mt-1">{whatsappAnalytics.overview.activeConversations} active</p>
                </div>
                <div className="bg-white rounded-lg shadow p-3 md:p-4">
                  <p className="text-xs md:text-sm text-gray-500">Messages</p>
                  <p className="text-xl md:text-2xl font-bold text-blue-600">{whatsappAnalytics.overview.totalMessages}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-3 md:p-4">
                  <p className="text-xs md:text-sm text-gray-500">AI Response Rate</p>
                  <p className="text-xl md:text-2xl font-bold text-green-600">{whatsappAnalytics.overview.aiResponseRate}%</p>
                  <p className="text-[10px] md:text-xs text-gray-500 mt-1">Auto-handled</p>
                </div>
                <div className="bg-white rounded-lg shadow p-3 md:p-4">
                  <p className="text-xs md:text-sm text-gray-500">Escalation Rate</p>
                  <p className="text-xl md:text-2xl font-bold text-red-600">{whatsappAnalytics.overview.escalationRate}%</p>
                  <p className="text-[10px] md:text-xs text-gray-500 mt-1">Need human</p>
                </div>
              </div>

              {/* Intent Breakdown Only - Simplified */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Customer Intent Breakdown</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {whatsappAnalytics.intentBreakdown && whatsappAnalytics.intentBreakdown.length > 0 &&
                          whatsappAnalytics.intentBreakdown.some(i => i.percentage > 0) ? (
                          (() => {
                            let offset = 0;
                            return whatsappAnalytics.intentBreakdown.slice(0, 5).map((item, idx) => {
                              if (item.percentage <= 0) return null;
                              const dashLength = (item.percentage / 100) * 88;
                              const segment = (
                                <circle
                                  key={idx}
                                  cx="18" cy="18" r="14"
                                  fill="none"
                                  stroke={intentColors[item.intent.toLowerCase()] || '#6b7280'}
                                  strokeWidth="3.5"
                                  strokeDasharray={`${dashLength} 88`}
                                  strokeDashoffset={-offset}
                                  strokeLinecap="round"
                                  transform="rotate(-90 18 18)"
                                />
                              );
                              offset += dashLength;
                              return segment;
                            });
                          })()
                        ) : null}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-700">
                          {whatsappAnalytics.intentBreakdown && whatsappAnalytics.intentBreakdown.length > 0
                            ? `${Math.round(whatsappAnalytics.intentBreakdown.reduce((sum, i) => sum + i.percentage, 0))}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Vehicle {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'vehicle')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Price {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'price')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Greeting {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'greeting')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">General {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'general')?.percentage || 0}%</span>
                    </div>
                  </div>
                </div>

                {/* AI Performance Summary - Simplified */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">AI Performance</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {whatsappAnalytics.performance.aiAccuracy > 0 && (
                          <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="3.5"
                            strokeDasharray={`${(whatsappAnalytics.performance.aiAccuracy / 100) * 88} 88`}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-700">{whatsappAnalytics.performance.aiAccuracy}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Accuracy {whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Satisfaction {whatsappAnalytics.performance.customerSatisfaction}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Resolution {whatsappAnalytics.performance.resolutionRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <span className="text-[10px] md:text-xs text-gray-600">Avg Time {whatsappAnalytics.overview.avgResponseTime}s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="bg-gradient-to-br from-green-50 via-white to-blue-50 rounded-lg border-l-4 border-green-500 p-3 md:p-4 shadow-sm">
                <h4 className="text-xs md:text-sm font-bold text-green-900 uppercase tracking-wide mb-2 md:mb-2.5 flex items-center gap-2">
                  <span className="text-base md:text-lg">📋</span>
                  <span className="leading-tight">Analisis WhatsApp AI</span>
                  <span className="text-green-600 font-normal mx-1">•</span>
                  <span className="text-green-700 font-semibold">Business Impact</span>
                </h4>
                <div className="space-y-2">
                  <div className="text-[10px] md:text-xs leading-snug">
                    <span className="font-bold text-green-700">💬 Conversations:</span>{' '}
                    <span className="text-gray-700">
                      {whatsappAnalytics.overview.totalConversations} conversations bulan ini.{' '}
                      {whatsappAnalytics.overview.aiResponseRate >= 80 ? (
                        <span className="text-green-600 font-semibold">AI menangani {whatsappAnalytics.overview.aiResponseRate}% secara otomatis</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">{100 - whatsappAnalytics.overview.aiResponseRate}% butuh bantuan human</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs leading-snug">
                    <span className="font-bold text-blue-700">🎯 Top Intent:</span>{' '}
                    <span className="text-gray-700">
                      {(() => {
                        const topIntent = whatsappAnalytics.intentBreakdown && whatsappAnalytics.intentBreakdown.length > 0
                          ? whatsappAnalytics.intentBreakdown.sort((a, b) => b.percentage - a.percentage)[0]
                          : null;
                        return topIntent ? `${topIntent.intent} (${topIntent.percentage}%)` : 'Belum ada data';
                      })()}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs leading-snug border-t border-green-200 pt-2 mt-2">
                    <span className="font-bold text-rose-700">⚡ Rekomendasi:</span>{' '}
                    <span className="text-gray-700">
                      <span className="text-green-600 font-semibold">1)</span> {whatsappAnalytics.performance.aiAccuracy < 90 ? 'Tingkatkan training AI untuk improve accuracy.' : 'Accuracy sudah baik, pertahankan.'}{' '}
                      <span className="text-green-600 font-semibold">2)</span> {whatsappAnalytics.overview.escalationRate > 20 ? 'Review escalation yang sering terjadi.' : 'Escalation rate terkendali.'}{' '}
                      <span className="text-green-600 font-semibold">3)</span> Monitor response time untuk tetap di bawah 1 menit.
                    </span>
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

/**
 * Shared Report Card Component
 */
/**
 * Shared Report Card Component
 */
function ReportCard({ report }: {
  report: { id: string; name: string; desc: string; icon: string; href?: string };
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow group flex flex-col justify-between">
      <div>
        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl mb-3 group-hover:bg-blue-50 transition-colors">
          {report.icon}
        </div>
        <h4 className="text-sm font-bold text-gray-900 mb-1">{report.name}</h4>
        <p className="text-[10px] text-gray-500 mb-4 line-clamp-2 leading-relaxed">{report.desc}</p>
      </div>

      {report.href ? (
        <Link
          href={report.href}
          className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm transition-all"
        >
          <span>View Details</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      ) : (
        <button
          disabled={true}
          className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
        >
          Coming Soon
        </button>
      )}
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams
export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm">Loading Analytics...</p>
        </div>
      </div>
    }>
      <AnalyticsPageInternal />
    </Suspense>
  );
}
