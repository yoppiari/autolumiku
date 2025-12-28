/**
 * WhatsApp AI Analytics Dashboard
 * Includes: Sales Department, Finance/Accounting, and WhatsApp AI metrics
 * Access: MANAGER (70+) only, Finance excluded
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROLE_LEVELS } from '@/lib/rbac';

type Department = 'sales' | 'finance' | 'whatsapp';

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  avgPrice: number;
  topBrands: { brand: string; count: number; revenue: number }[];
  monthlySales: { month: string; count: number; revenue: number }[];
}

interface FinanceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  byStatus: { status: string; count: number; amount: number }[];
  monthlyPayments: { month: string; collected: number; pending: number }[];
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

export default function AnalyticsPage() {
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const [userRoleLevel, setUserRoleLevel] = useState(ROLE_LEVELS.SALES);
  const [activeDepartment, setActiveDepartment] = useState<Department>('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [whatsappAnalytics, setWhatsappAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  // Access guard: MANAGER (70+) only, exclude FINANCE
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const roleLevel = user.roleLevel || ROLE_LEVELS.SALES;
      setUserRoleLevel(roleLevel);

      // Block if below MANAGER or is FINANCE
      if (roleLevel < ROLE_LEVELS.MANAGER || roleLevel === ROLE_LEVELS.FINANCE) {
        setAccessDenied(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
        return;
      }
    }
    loadAnalytics();
  }, [router]);

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

      // Load finance stats
      const financeRes = await fetch('/api/v1/analytics/finance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (financeRes.ok) {
        const financeData = await financeRes.json();
        setFinanceStats(financeData.data);
      }

      // Load WhatsApp analytics
      if (parsedUser?.tenantId) {
        const waRes = await fetch(`/api/v1/whatsapp-ai/analytics?tenantId=${parsedUser.tenantId}&range=${timeRange}`);
        if (waRes.ok) {
          const waData = await waRes.json();
          if (waData.success) setWhatsappAnalytics(waData.data);
        }
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `/api/v1/analytics/export?format=${format}&department=${activeDepartment}&period=${period}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${activeDepartment}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Gagal mengekspor laporan');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Terjadi kesalahan saat mengekspor');
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

  // Intent colors for donut chart
  const intentColors: Record<string, string> = {
    greeting: '#22c55e',
    vehicle: '#3b82f6',
    price: '#a855f7',
    general: '#f59e0b',
    closing: '#ef4444',
    unknown: '#6b7280',
  };

  // Access denied screen
  if (accessDenied) {
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

          {/* Period Filter & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter - for Sales/Finance */}
            {(activeDepartment === 'sales' || activeDepartment === 'finance') && (
              <>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Bulanan</option>
                  <option value="quarterly">Kuartalan</option>
                  <option value="yearly">Tahunan</option>
                </select>
                <button
                  onClick={() => handleExport('excel')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF
                </button>
              </>
            )}
            {/* Time Range - for WhatsApp */}
            {activeDepartment === 'whatsapp' && (
              <div className="flex items-center gap-1">
                {['today', 'week', 'month'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as typeof timeRange)}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      timeRange === range ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
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
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
              activeDepartment === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">📊</span>
            <span className="hidden sm:inline">Sales Department</span>
            <span className="sm:hidden">Sales</span>
          </button>
          <button
            onClick={() => setActiveDepartment('finance')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
              activeDepartment === 'finance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">💰</span>
            <span className="hidden sm:inline">Finance / Accounting</span>
            <span className="sm:hidden">Finance</span>
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
              activeDepartment === 'whatsapp'
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Penjualan</p>
              <p className="text-2xl font-bold text-gray-900">{salesStats?.totalSales || 0}</p>
              <p className="text-xs text-green-600 mt-1">Unit terjual</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">{formatRupiah(salesStats?.totalRevenue || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Omzet keseluruhan</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Rata-rata Harga</p>
              <p className="text-2xl font-bold text-gray-900">{formatRupiah(salesStats?.avgPrice || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Per unit</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Top Brand</p>
              <p className="text-2xl font-bold text-purple-600">{salesStats?.topBrands?.[0]?.brand || '-'}</p>
              <p className="text-xs text-gray-500 mt-1">{salesStats?.topBrands?.[0]?.count || 0} unit</p>
            </div>
          </div>

          {/* Chart Section - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sales Performance Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Performa Penjualan</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {/* Target achievement - assume target is 100 units */}
                    {(salesStats?.totalSales || 0) > 0 && (
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3.5"
                        strokeDasharray={`${Math.min((salesStats?.totalSales || 0) / 100, 1) * 88} 88`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700">{salesStats?.totalSales || 0}</span>
                    <span className="text-[10px] text-gray-500">Unit</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-xs text-gray-600">Terjual {salesStats?.totalSales || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-300"></span>
                  <span className="text-xs text-gray-600">Target 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs text-gray-600">Achievement {Math.min(Math.round(((salesStats?.totalSales || 0) / 100) * 100), 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-xs text-gray-600">Gap {Math.max(100 - (salesStats?.totalSales || 0), 0)}</span>
                </div>
              </div>
            </div>

            {/* Brand Distribution Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Brand</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {salesStats?.topBrands && salesStats.topBrands.length > 0 && (
                      (() => {
                        const total = salesStats.topBrands.reduce((sum, b) => sum + b.count, 0);
                        let offset = 0;
                        const brandColors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];
                        return salesStats.topBrands.slice(0, 5).map((brand, idx) => {
                          if (brand.count <= 0 || total <= 0) return null;
                          const percentage = (brand.count / total) * 100;
                          const dashLength = (percentage / 100) * 88;
                          const segment = (
                            <circle
                              key={idx}
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke={brandColors[idx % brandColors.length]}
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
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700">{salesStats?.topBrands?.length || 0}</span>
                    <span className="text-[10px] text-gray-500">Brand</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {(() => {
                  const brandColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500'];
                  const total = salesStats?.topBrands?.reduce((sum, b) => sum + b.count, 0) || 0;
                  return salesStats?.topBrands?.slice(0, 6).map((brand, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${brandColors[idx % brandColors.length]}`}></span>
                      <span className="text-xs text-gray-600 truncate">{brand.brand} {total > 0 ? Math.round((brand.count / total) * 100) : 0}%</span>
                    </div>
                  )) || (
                    <div className="col-span-2 text-xs text-gray-500 text-center">Belum ada data</div>
                  );
                })()}
              </div>
            </div>

            {/* Revenue Distribution Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Revenue</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {salesStats?.topBrands && salesStats.topBrands.length > 0 && (
                      (() => {
                        const total = salesStats.topBrands.reduce((sum, b) => sum + b.revenue, 0);
                        let offset = 0;
                        const brandColors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];
                        return salesStats.topBrands.slice(0, 5).map((brand, idx) => {
                          if (brand.revenue <= 0 || total <= 0) return null;
                          const percentage = (brand.revenue / total) * 100;
                          const dashLength = (percentage / 100) * 88;
                          const segment = (
                            <circle
                              key={idx}
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke={brandColors[idx % brandColors.length]}
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
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-gray-700">{formatRupiah(salesStats?.totalRevenue || 0).replace('Rp', '').trim().split(',')[0]}</span>
                    <span className="text-[10px] text-gray-500">Juta</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {(() => {
                  const brandColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500'];
                  const total = salesStats?.topBrands?.reduce((sum, b) => sum + b.revenue, 0) || 0;
                  return salesStats?.topBrands?.slice(0, 6).map((brand, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${brandColors[idx % brandColors.length]}`}></span>
                      <span className="text-xs text-gray-600 truncate">{brand.brand} {total > 0 ? Math.round((brand.revenue / total) * 100) : 0}%</span>
                    </div>
                  )) || (
                    <div className="col-span-2 text-xs text-gray-500 text-center">Belum ada data</div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Monthly Trend Bar Chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Tren Penjualan Bulanan</h4>
            <div className="h-48 flex items-end gap-2 px-4">
              {salesStats?.monthlySales && salesStats.monthlySales.length > 0 ? (
                (() => {
                  const maxCount = Math.max(...salesStats.monthlySales.map(m => m.count), 1);
                  return salesStats.monthlySales.map((month, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-600 font-medium">{month.count}</span>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${Math.max((month.count / maxCount) * 140, 4)}px` }}
                        title={`${month.month}: ${month.count} unit - ${formatRupiah(month.revenue)}`}
                      ></div>
                      <span className="text-[9px] text-gray-500 truncate w-full text-center">{month.month.substring(0, 3)}</span>
                    </div>
                  ));
                })()
              ) : (
                // Default empty bars
                ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400">0</span>
                    <div className="w-full bg-gray-200 rounded-t h-4"></div>
                    <span className="text-[9px] text-gray-400">{month}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                <span className="text-xs text-gray-600">Unit Terjual</span>
              </div>
            </div>
          </div>

          {/* Top Brands Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Penjualan per Brand</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Terjual</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesStats?.topBrands?.map((brand, idx) => {
                    const totalRevenue = salesStats.topBrands?.reduce((sum, b) => sum + b.revenue, 0) || 0;
                    const contribution = totalRevenue > 0 ? Math.round((brand.revenue / totalRevenue) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{brand.brand}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{brand.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatRupiah(brand.revenue)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            contribution >= 30 ? 'bg-green-100 text-green-800' :
                            contribution >= 15 ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {contribution}%
                          </span>
                        </td>
                      </tr>
                    );
                  }) || (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada data penjualan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Management Analysis Footnotes */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-3">
            <h4 className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
              <span>📋</span> Analisis Manajemen Showroom
            </h4>
            <div className="space-y-2">
              {/* Analysis Point 1 - Performance */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Performa Penjualan:</span>{' '}
                {(salesStats?.totalSales || 0) >= 80 ? (
                  <>Target tercapai dengan baik ({salesStats?.totalSales || 0} unit). <span className="text-green-600">Strategi pemasaran efektif.</span> Pertahankan momentum dengan program loyalitas pelanggan.</>
                ) : (salesStats?.totalSales || 0) >= 50 ? (
                  <>Pencapaian moderat ({salesStats?.totalSales || 0} unit, {Math.round(((salesStats?.totalSales || 0) / 100) * 100)}% target). <span className="text-amber-600">Perlu peningkatan.</span> Evaluasi strategi promosi dan perluas jangkauan pemasaran digital.</>
                ) : (
                  <>Pencapaian rendah ({salesStats?.totalSales || 0} unit). <span className="text-red-600">Perlu tindakan korektif segera.</span> Rekomendasi: review pricing strategy, tingkatkan kualitas leads, dan intensifkan follow-up prospek.</>
                )}
              </div>

              {/* Analysis Point 2 - Brand Mix */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Strategi Brand:</span>{' '}
                {salesStats?.topBrands && salesStats.topBrands.length > 0 ? (
                  <>
                    {salesStats.topBrands[0].brand} mendominasi pasar ({salesStats.topBrands[0].count} unit).
                    {salesStats.topBrands.length > 1 ? (
                      <> Diversifikasi dengan {salesStats.topBrands[1]?.brand} dapat mengurangi risiko ketergantungan satu brand.</>
                    ) : (
                      <> <span className="text-amber-600">Perlu diversifikasi brand</span> untuk mengurangi risiko market concentration.</>
                    )}
                  </>
                ) : (
                  <>Belum ada data brand. Mulai tracking penjualan per brand untuk analisis market share.</>
                )}
              </div>

              {/* Analysis Point 3 - Revenue */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Optimasi Revenue:</span>{' '}
                {(salesStats?.avgPrice || 0) > 200000000 ? (
                  <>Rata-rata harga jual tinggi ({formatRupiah(salesStats?.avgPrice || 0)}). <span className="text-green-600">Margin profit optimal.</span> Fokus pada segmen premium dan value-added services.</>
                ) : (salesStats?.avgPrice || 0) > 100000000 ? (
                  <>Rata-rata harga jual menengah ({formatRupiah(salesStats?.avgPrice || 0)}). Pertimbangkan upselling aksesoris dan paket after-sales service untuk meningkatkan revenue per unit.</>
                ) : (
                  <>Rata-rata harga jual rendah ({formatRupiah(salesStats?.avgPrice || 0)}). <span className="text-amber-600">Evaluasi product mix.</span> Pertimbangkan penambahan inventory segment menengah-atas.</>
                )}
              </div>

              {/* Analysis Point 4 - Action Items */}
              <div className="text-[10px] text-slate-600 leading-snug border-t border-slate-200 pt-2 mt-2">
                <span className="font-semibold text-slate-700">Rekomendasi Aksi:</span>{' '}
                <span className="text-blue-600">1)</span> Review target bulanan dengan tim sales. {' '}
                <span className="text-blue-600">2)</span> Evaluasi conversion rate leads-to-sales. {' '}
                <span className="text-blue-600">3)</span> Analisis kompetitor pricing. {' '}
                <span className="text-blue-600">4)</span> Optimasi inventory berdasarkan demand forecast.
              </div>
            </div>

            {/* Footer timestamp */}
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[8px] text-slate-400">
                *Analisis otomatis berdasarkan data {period === 'monthly' ? 'bulanan' : period === 'quarterly' ? 'kuartalan' : 'tahunan'}. Generated: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[8px] text-slate-400">Prima Mobil Analytics v1.0</span>
            </div>
          </div>
        </div>
      )}

      {/* Finance Department Report */}
      {!isLoading && activeDepartment === 'finance' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Invoice</p>
              <p className="text-2xl font-bold text-gray-900">{financeStats?.totalInvoices || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Invoice dibuat</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Tagihan</p>
              <p className="text-2xl font-bold text-blue-600">{formatRupiah(financeStats?.totalAmount || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Keseluruhan</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Sudah Dibayar</p>
              <p className="text-2xl font-bold text-green-600">{formatRupiah(financeStats?.paidAmount || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Terkumpul</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">{formatRupiah(financeStats?.pendingAmount || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Belum terbayar</p>
            </div>
          </div>

          {/* Chart Section - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Collection Rate Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Tingkat Koleksi</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {/* Paid portion */}
                    {(financeStats?.paidAmount || 0) > 0 && (financeStats?.totalAmount || 0) > 0 && (
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3.5"
                        strokeDasharray={`${((financeStats?.paidAmount || 0) / (financeStats?.totalAmount || 1)) * 88} 88`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    )}
                    {/* Pending portion */}
                    {(financeStats?.pendingAmount || 0) > 0 && (financeStats?.totalAmount || 0) > 0 && (
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3.5"
                        strokeDasharray={`${((financeStats?.pendingAmount || 0) / (financeStats?.totalAmount || 1)) * 88} 88`}
                        strokeDashoffset={`${-((financeStats?.paidAmount || 0) / (financeStats?.totalAmount || 1)) * 88}`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700">
                      {financeStats?.totalAmount ? Math.round((financeStats.paidAmount / financeStats.totalAmount) * 100) : 0}%
                    </span>
                    <span className="text-[10px] text-gray-500">Terkumpul</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-xs text-gray-600">Lunas {financeStats?.totalAmount ? Math.round((financeStats.paidAmount / financeStats.totalAmount) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-xs text-gray-600">Outstanding {financeStats?.totalAmount ? Math.round((financeStats.pendingAmount / financeStats.totalAmount) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs text-gray-600">Total {financeStats?.totalInvoices || 0} inv</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-xs text-gray-600">Target 100%</span>
                </div>
              </div>
            </div>

            {/* Invoice Status Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Status Invoice</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {financeStats?.byStatus && financeStats.byStatus.length > 0 && (
                      (() => {
                        const total = financeStats.byStatus.reduce((sum, s) => sum + s.count, 0);
                        let offset = 0;
                        const statusColors: Record<string, string> = {
                          paid: '#22c55e',
                          partial: '#f59e0b',
                          unpaid: '#ef4444',
                          draft: '#6b7280',
                          cancelled: '#94a3b8'
                        };
                        return financeStats.byStatus.map((item, idx) => {
                          if (item.count <= 0 || total <= 0) return null;
                          const percentage = (item.count / total) * 100;
                          const dashLength = (percentage / 100) * 88;
                          const segment = (
                            <circle
                              key={idx}
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke={statusColors[item.status] || '#6b7280'}
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
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700">{financeStats?.totalInvoices || 0}</span>
                    <span className="text-[10px] text-gray-500">Invoice</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {(() => {
                  const total = financeStats?.byStatus?.reduce((sum, s) => sum + s.count, 0) || 0;
                  const statusLabels: Record<string, string> = {
                    paid: 'Lunas',
                    partial: 'Sebagian',
                    unpaid: 'Belum Bayar',
                    draft: 'Draft',
                    cancelled: 'Batal'
                  };
                  const statusColors: Record<string, string> = {
                    paid: 'bg-green-500',
                    partial: 'bg-amber-500',
                    unpaid: 'bg-red-500',
                    draft: 'bg-gray-500',
                    cancelled: 'bg-slate-400'
                  };
                  return financeStats?.byStatus?.slice(0, 6).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${statusColors[item.status] || 'bg-gray-500'}`}></span>
                      <span className="text-xs text-gray-600">{statusLabels[item.status] || item.status} {total > 0 ? Math.round((item.count / total) * 100) : 0}%</span>
                    </div>
                  )) || (
                    <div className="col-span-2 text-xs text-gray-500 text-center">Belum ada data</div>
                  );
                })()}
              </div>
            </div>

            {/* Amount Distribution Donut */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Nominal</h4>
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    {financeStats?.byStatus && financeStats.byStatus.length > 0 && (
                      (() => {
                        const total = financeStats.byStatus.reduce((sum, s) => sum + s.amount, 0);
                        let offset = 0;
                        const statusColors: Record<string, string> = {
                          paid: '#22c55e',
                          partial: '#f59e0b',
                          unpaid: '#ef4444',
                          draft: '#6b7280',
                          cancelled: '#94a3b8'
                        };
                        return financeStats.byStatus.map((item, idx) => {
                          if (item.amount <= 0 || total <= 0) return null;
                          const percentage = (item.amount / total) * 100;
                          const dashLength = (percentage / 100) * 88;
                          const segment = (
                            <circle
                              key={idx}
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke={statusColors[item.status] || '#6b7280'}
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
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-gray-700">{formatRupiah(financeStats?.totalAmount || 0).replace('Rp', '').trim().split(',')[0]}</span>
                    <span className="text-[10px] text-gray-500">Juta</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {(() => {
                  const total = financeStats?.byStatus?.reduce((sum, s) => sum + s.amount, 0) || 0;
                  const statusLabels: Record<string, string> = {
                    paid: 'Lunas',
                    partial: 'Sebagian',
                    unpaid: 'Belum Bayar',
                    draft: 'Draft',
                    cancelled: 'Batal'
                  };
                  const statusColors: Record<string, string> = {
                    paid: 'bg-green-500',
                    partial: 'bg-amber-500',
                    unpaid: 'bg-red-500',
                    draft: 'bg-gray-500',
                    cancelled: 'bg-slate-400'
                  };
                  return financeStats?.byStatus?.slice(0, 6).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${statusColors[item.status] || 'bg-gray-500'}`}></span>
                      <span className="text-xs text-gray-600">{statusLabels[item.status] || item.status} {total > 0 ? Math.round((item.amount / total) * 100) : 0}%</span>
                    </div>
                  )) || (
                    <div className="col-span-2 text-xs text-gray-500 text-center">Belum ada data</div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Monthly Payment Trend Bar Chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Tren Pembayaran Bulanan</h4>
            <div className="h-48 flex items-end gap-2 px-4">
              {financeStats?.monthlyPayments && financeStats.monthlyPayments.length > 0 ? (
                (() => {
                  const maxAmount = Math.max(...financeStats.monthlyPayments.map(m => Math.max(m.collected, m.pending)), 1);
                  return financeStats.monthlyPayments.map((month, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '140px' }}>
                        {/* Collected bar */}
                        <div
                          className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-600"
                          style={{ height: `${Math.max((month.collected / maxAmount) * 140, 4)}px` }}
                          title={`Terkumpul: ${formatRupiah(month.collected)}`}
                        ></div>
                        {/* Pending bar */}
                        <div
                          className="flex-1 bg-red-400 rounded-t transition-all hover:bg-red-500"
                          style={{ height: `${Math.max((month.pending / maxAmount) * 140, 4)}px` }}
                          title={`Outstanding: ${formatRupiah(month.pending)}`}
                        ></div>
                      </div>
                      <span className="text-[9px] text-gray-500 truncate w-full text-center">{month.month.substring(0, 3)}</span>
                    </div>
                  ));
                })()
              ) : (
                // Default empty bars
                ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '140px' }}>
                      <div className="flex-1 bg-gray-200 rounded-t h-4"></div>
                      <div className="flex-1 bg-gray-100 rounded-t h-2"></div>
                    </div>
                    <span className="text-[9px] text-gray-400">{month}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500"></span>
                <span className="text-xs text-gray-600">Terkumpul</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-400"></span>
                <span className="text-xs text-gray-600">Outstanding</span>
              </div>
            </div>
          </div>

          {/* Invoice Status Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Detail Status Invoice</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Nominal</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {financeStats?.byStatus?.map((item, idx) => {
                    const totalAmount = financeStats.byStatus?.reduce((sum, s) => sum + s.amount, 0) || 0;
                    const contribution = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.status === 'paid' ? 'bg-green-100 text-green-800' :
                            item.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'unpaid' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status === 'paid' ? 'Lunas' :
                             item.status === 'partial' ? 'Sebagian' :
                             item.status === 'unpaid' ? 'Belum Bayar' :
                             item.status === 'draft' ? 'Draft' : item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{item.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatRupiah(item.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'paid' ? 'bg-green-100 text-green-800' :
                            item.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {contribution}%
                          </span>
                        </td>
                      </tr>
                    );
                  }) || (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada data invoice</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collection Rate Progress */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Tingkat Koleksi</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-20">Terkumpul</span>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-4 bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${financeStats?.totalAmount ? (financeStats.paidAmount / financeStats.totalAmount) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-bold text-green-600 w-16 text-right">
                  {financeStats?.totalAmount ? Math.round((financeStats.paidAmount / financeStats.totalAmount) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-20">Outstanding</span>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-4 bg-red-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${financeStats?.totalAmount ? (financeStats.pendingAmount / financeStats.totalAmount) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600 w-16 text-right">
                  {financeStats?.totalAmount ? Math.round((financeStats.pendingAmount / financeStats.totalAmount) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Management Analysis Footnotes */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-3">
            <h4 className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-2">
              <span>💰</span> Analisis Keuangan Showroom
            </h4>
            <div className="space-y-2">
              {/* Analysis Point 1 - Collection Rate */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Tingkat Koleksi:</span>{' '}
                {(() => {
                  const rate = financeStats?.totalAmount ? Math.round((financeStats.paidAmount / financeStats.totalAmount) * 100) : 0;
                  if (rate >= 90) {
                    return <>Koleksi excellent ({rate}%). <span className="text-green-600">Cash flow sehat.</span> Pertahankan kebijakan payment term dan monitoring rutin.</>;
                  } else if (rate >= 70) {
                    return <>Koleksi baik ({rate}%). <span className="text-blue-600">Masih dalam target.</span> Intensifkan follow-up invoice mendekati jatuh tempo.</>;
                  } else if (rate >= 50) {
                    return <>Koleksi moderat ({rate}%). <span className="text-amber-600">Perlu perhatian.</span> Review aging AR dan prioritaskan penagihan invoice overdue.</>;
                  } else {
                    return <>Koleksi rendah ({rate}%). <span className="text-red-600">Butuh tindakan segera.</span> Evaluasi credit policy, pertimbangkan insentif pelunasan dini.</>;
                  }
                })()}
              </div>

              {/* Analysis Point 2 - Outstanding */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Piutang Outstanding:</span>{' '}
                {(financeStats?.pendingAmount || 0) > 0 ? (
                  <>
                    Total outstanding {formatRupiah(financeStats?.pendingAmount || 0)}.
                    {(financeStats?.pendingAmount || 0) > (financeStats?.paidAmount || 0) ? (
                      <> <span className="text-red-600">Outstanding melebihi koleksi.</span> Segera lakukan rekonsiliasi AR dan intensifkan penagihan.</>
                    ) : (
                      <> Proporsi masih terkendali. Pastikan monitoring aging schedule berjalan rutin.</>
                    )}
                  </>
                ) : (
                  <>Tidak ada outstanding. <span className="text-green-600">Excellent!</span> Semua invoice sudah terbayar lunas.</>
                )}
              </div>

              {/* Analysis Point 3 - Invoice Health */}
              <div className="text-[10px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Kesehatan Invoice:</span>{' '}
                {(() => {
                  const paidCount = financeStats?.byStatus?.find(s => s.status === 'paid')?.count || 0;
                  const unpaidCount = financeStats?.byStatus?.find(s => s.status === 'unpaid')?.count || 0;
                  const total = financeStats?.totalInvoices || 0;
                  const paidRatio = total > 0 ? Math.round((paidCount / total) * 100) : 0;

                  if (paidRatio >= 80) {
                    return <>Rasio invoice lunas tinggi ({paidRatio}%). <span className="text-green-600">Manajemen AR efektif.</span></>;
                  } else if (paidRatio >= 60) {
                    return <>Rasio invoice lunas moderat ({paidRatio}%). Perlu peningkatan collection effort.</>;
                  } else {
                    return <>Rasio invoice lunas rendah ({paidRatio}%). <span className="text-red-600">Evaluasi credit approval process.</span></>;
                  }
                })()}
              </div>

              {/* Analysis Point 4 - Action Items */}
              <div className="text-[10px] text-slate-600 leading-snug border-t border-amber-200 pt-2 mt-2">
                <span className="font-semibold text-slate-700">Rekomendasi Aksi:</span>{' '}
                <span className="text-amber-600">1)</span> Review aging AR &gt;30 hari. {' '}
                <span className="text-amber-600">2)</span> Follow-up invoice jatuh tempo minggu ini. {' '}
                <span className="text-amber-600">3)</span> Evaluasi credit limit customer dengan outstanding tinggi. {' '}
                <span className="text-amber-600">4)</span> Rekonsiliasi pembayaran dengan bank statement.
              </div>
            </div>

            {/* Footer timestamp */}
            <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between">
              <span className="text-[8px] text-amber-600/70">
                *Analisis otomatis berdasarkan data {period === 'monthly' ? 'bulanan' : period === 'quarterly' ? 'kuartalan' : 'tahunan'}. Generated: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[8px] text-amber-600/70">Prima Mobil Finance v1.0</span>
            </div>
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
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Conversations</p>
                  <p className="text-2xl font-bold text-gray-900">{whatsappAnalytics.overview.totalConversations}</p>
                  <p className="text-xs text-green-600 mt-1">{whatsappAnalytics.overview.activeConversations} active</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Messages</p>
                  <p className="text-2xl font-bold text-blue-600">{whatsappAnalytics.overview.totalMessages}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">AI Response Rate</p>
                  <p className="text-2xl font-bold text-green-600">{whatsappAnalytics.overview.aiResponseRate}%</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Escalation Rate</p>
                  <p className="text-2xl font-bold text-red-600">{whatsappAnalytics.overview.escalationRate}%</p>
                </div>
              </div>

              {/* Donut Charts Row - AI Performance, Intent Breakdown, AI Accuracy */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Performance Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">AI Performance</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        {/* Background circle - gray */}
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {/* Only show colored segments if value > 0 */}
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
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-xs text-gray-600">Accuracy {whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-xs text-gray-600">Satisfaction {whatsappAnalytics.performance.customerSatisfaction}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-xs text-gray-600">Resolution {whatsappAnalytics.performance.resolutionRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <span className="text-xs text-gray-600">Response {whatsappAnalytics.overview.aiResponseRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-xs text-gray-600">Escalation {whatsappAnalytics.overview.escalationRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <span className="text-xs text-gray-600">Avg Time {whatsappAnalytics.overview.avgResponseTime}s</span>
                    </div>
                  </div>
                </div>

                {/* Intent Breakdown Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Intent Breakdown</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        {/* Background circle - gray */}
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {/* Only render segments if data exists and has percentage > 0 */}
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
                  {/* Legend - always show standard intents */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-xs text-gray-600">Greeting {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'greeting')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-xs text-gray-600">Vehicle {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'vehicle')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-xs text-gray-600">Price {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'price')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-xs text-gray-600">General {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'general')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-xs text-gray-600">Closing {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'closing')?.percentage || 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                      <span className="text-xs text-gray-600">Unknown {whatsappAnalytics.intentBreakdown?.find(i => i.intent.toLowerCase() === 'unknown')?.percentage || 0}%</span>
                    </div>
                  </div>
                </div>

                {/* AI Accuracy Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">AI Accuracy</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        {/* Background circle - gray */}
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {/* Only show colored segments if values > 0 */}
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
                        {/* Wrong segment - only if accuracy < 100 and there's some data */}
                        {whatsappAnalytics.performance.aiAccuracy < 100 && whatsappAnalytics.overview.totalMessages > 0 && (
                          <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeDasharray={`${((100 - whatsappAnalytics.performance.aiAccuracy) / 100) * 88} 88`}
                            strokeDashoffset={`${-(whatsappAnalytics.performance.aiAccuracy / 100) * 88}`}
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
                  {/* Legend - standardized colors matching other charts */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span className="text-xs text-gray-600">Correct {whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-xs text-gray-600">Partial 0%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-xs text-gray-600">Wrong {100 - whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-xs text-gray-600">Escalated {whatsappAnalytics.overview.escalationRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <span className="text-xs text-gray-600">Timeout 0%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <span className="text-xs text-gray-600">No Response 0%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Activity - Always show table with proper structure */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Staff Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Phone</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commands</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {whatsappAnalytics.staffActivity && whatsappAnalytics.staffActivity.length > 0 ? (
                        whatsappAnalytics.staffActivity.map((staff, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.staffPhone}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{staff.commandCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.successRate >= 80 ? 'bg-green-100 text-green-800' :
                                staff.successRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {staff.successRate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{staff.lastActive}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">0</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">0%</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
