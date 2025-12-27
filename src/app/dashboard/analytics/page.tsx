/**
 * Analytics Dashboard
 * Department reports for Sales and Finance/Accounting
 * Access: MANAGER (70+) only
 */

'use client';

import React, { useState, useEffect } from 'react';
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

export default function AnalyticsPage() {
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const [userRoleLevel, setUserRoleLevel] = useState(ROLE_LEVELS.SALES);
  const [activeDepartment, setActiveDepartment] = useState<Department>('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  // Access guard: MANAGER (70+) only
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const roleLevel = user.roleLevel || ROLE_LEVELS.SALES;
      setUserRoleLevel(roleLevel);

      if (roleLevel < ROLE_LEVELS.MANAGER) {
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
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Laporan performa untuk manajemen Prima Mobil</p>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          {/* Period Filter */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="monthly">Bulanan</option>
            <option value="quarterly">Kuartalan</option>
            <option value="yearly">Tahunan</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {/* Department Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeDepartment === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">📊</span>
            Sales Department
          </button>
          <button
            onClick={() => setActiveDepartment('finance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeDepartment === 'finance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">💰</span>
            Finance / Accounting
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeDepartment === 'whatsapp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">💬</span>
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp AI Analytics</h3>
            <p className="text-gray-600 mb-4">Lihat performa AI dalam menangani percakapan WhatsApp</p>
            <a
              href="/dashboard/whatsapp-ai/analytics"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Buka WhatsApp AI Analytics
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
