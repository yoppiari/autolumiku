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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 text-sm">← Back</Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Laporan performa untuk manajemen Prima Mobil</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
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
                onClick={() => handleExport('pdf')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
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

      {/* Department Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeDepartment === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">📊</span>
            Sales Department
          </button>
          <button
            onClick={() => setActiveDepartment('finance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeDepartment === 'finance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">💰</span>
            Finance / Accounting
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeDepartment === 'whatsapp'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">💬</span>
            WhatsApp AI
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesStats?.topBrands?.map((brand, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{brand.brand}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{brand.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatRupiah(brand.revenue)}</td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada data penjualan</td>
                    </tr>
                  )}
                </tbody>
              </table>
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

          {/* Invoice Status Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Status Invoice</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {financeStats?.byStatus?.map((item, idx) => (
                    <tr key={idx}>
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
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada data invoice</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collection Rate */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tingkat Koleksi Pembayaran</h3>
            <div className="flex items-center gap-4">
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
              <span className="text-lg font-bold text-gray-900">
                {financeStats?.totalAmount ? Math.round((financeStats.paidAmount / financeStats.totalAmount) * 100) : 0}%
              </span>
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
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {/* Accuracy - Green */}
                        <circle
                          cx="18" cy="18" r="14"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="3.5"
                          strokeDasharray={`${(whatsappAnalytics.performance.aiAccuracy / 100) * 88} 88`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
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
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-xs text-gray-600">Escalation {whatsappAnalytics.overview.escalationRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Intent Breakdown Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Intent Breakdown</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {whatsappAnalytics.intentBreakdown && whatsappAnalytics.intentBreakdown.length > 0 ? (
                          (() => {
                            let offset = 0;
                            return whatsappAnalytics.intentBreakdown.slice(0, 5).map((item, idx) => {
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
                          {whatsappAnalytics.intentBreakdown?.reduce((sum, i) => sum + i.count, 0) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {whatsappAnalytics.intentBreakdown?.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: intentColors[item.intent.toLowerCase()] || '#6b7280' }}
                        ></span>
                        <span className="text-xs text-gray-600 capitalize">{item.intent} {item.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Accuracy Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">AI Accuracy</h4>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-32 h-32" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                        {/* Correct responses - Green */}
                        <circle
                          cx="18" cy="18" r="14"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="3.5"
                          strokeDasharray={`${(whatsappAnalytics.performance.aiAccuracy / 100) * 88} 88`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                        {/* Wrong/Escalated - show remaining */}
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
                      <span className="text-xs text-gray-600">Correct {whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span className="text-xs text-gray-600">Partial</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-xs text-gray-600">Wrong {100 - whatsappAnalytics.performance.aiAccuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-xs text-gray-600">Escalated</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Activity */}
              {whatsappAnalytics.staffActivity && whatsappAnalytics.staffActivity.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Staff Activity</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Phone</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commands</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last Active</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {whatsappAnalytics.staffActivity.map((staff, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.staffPhone}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{staff.commandCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className={`font-medium ${staff.successRate >= 80 ? 'text-green-600' : staff.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {staff.successRate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{staff.lastActive}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Show placeholder if no staff activity */}
              {(!whatsappAnalytics.staffActivity || whatsappAnalytics.staffActivity.length === 0) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Activity</h3>
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="text-sm">Belum ada aktivitas staff tercatat</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
