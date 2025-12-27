/**
 * Invoice List Page
 * Displays all invoices with stats, filters, and table
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaPlus, FaSearch, FaFileInvoice, FaEye, FaChartLine } from 'react-icons/fa';
import { SalesInvoice, INVOICE_STATUS, formatRupiah, formatDate } from '@/types/invoice';
import { ROLE_LEVELS } from '@/lib/rbac';

interface InvoiceStats {
  total: number;
  totalAmount: number;
  unpaid: number;
  unpaidAmount: number;
  partial: number;
  partialAmount: number;
  paid: number;
  paidAmount: number;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userRoleLevel, setUserRoleLevel] = useState(ROLE_LEVELS.SALES);
  const [accessDenied, setAccessDenied] = useState(false);

  // Access guard: FINANCE (60+) only - block SALES
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const roleLevel = user.roleLevel || ROLE_LEVELS.SALES;
      setUserRoleLevel(roleLevel);

      // SALES (30) cannot access invoices page
      if (roleLevel < ROLE_LEVELS.FINANCE) {
        setAccessDenied(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
        return;
      }
    }
  }, [router]);

  useEffect(() => {
    if (!accessDenied) {
      loadInvoices();
    }
  }, [page, statusFilter, accessDenied]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/v1/sales-invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setInvoices(data.data.invoices || []);
        setStats(data.data.stats || null);
        setTotalPages(data.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadInvoices();
  };

  const canCreate = userRoleLevel >= ROLE_LEVELS.FINANCE;
  const canVoid = userRoleLevel >= ROLE_LEVELS.MANAGER;

  // Show access denied message briefly before redirect
  if (accessDenied) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600">Anda tidak memiliki akses ke halaman Invoice.</p>
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Invoice Penjualan</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola invoice penjualan kendaraan</p>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <Link
            href="/dashboard/invoices/ledger"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <FaChartLine className="text-xs" />
            Alur Transaksi
          </Link>
          {canCreate && (
            <Link
              href="/dashboard/invoices/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <FaPlus className="text-xs" />
              Buat Invoice
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Invoice</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{formatRupiah(stats?.totalAmount || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaFileInvoice className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Belum Bayar</p>
              <p className="text-xl md:text-2xl font-bold text-red-600">{stats?.unpaid || 0}</p>
              <p className="text-xs text-red-500 mt-1">{formatRupiah(stats?.unpaidAmount || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 font-bold">!</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Sebagian</p>
              <p className="text-xl md:text-2xl font-bold text-yellow-600">{stats?.partial || 0}</p>
              <p className="text-xs text-yellow-500 mt-1">{formatRupiah(stats?.partialAmount || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-yellow-600 font-bold">~</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Lunas</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">{stats?.paid || 0}</p>
              <p className="text-xs text-green-500 mt-1">{formatRupiah(stats?.paidAmount || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 font-bold">✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Cari no invoice, customer, kendaraan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="partial">Sebagian</option>
            <option value="paid">Lunas</option>
            <option value="void">Batal</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2 text-sm">Memuat data...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FaFileInvoice className="text-gray-300 text-4xl mx-auto mb-3" />
            <p className="text-gray-500">Belum ada invoice</p>
            {canCreate && (
              <Link
                href="/dashboard/invoices/create"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <FaPlus className="text-xs" />
                Buat Invoice Pertama
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">No. Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Kendaraan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Terbayar</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-600">{invoice.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.customer?.name || '-'}</p>
                          <p className="text-xs text-gray-500">{invoice.customer?.phone || ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900">
                            {invoice.vehicleMake} {invoice.vehicleModel}
                          </p>
                          <p className="text-xs text-gray-500">{invoice.vehiclePlateNumber || invoice.vehicleYear}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatRupiah(invoice.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {formatRupiah(invoice.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS[invoice.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {INVOICE_STATUS[invoice.status]?.label || invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <FaEye />
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-blue-600">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">{formatDate(invoice.invoiceDate)}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS[invoice.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {INVOICE_STATUS[invoice.status]?.label || invoice.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{invoice.customer?.name || '-'}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    {invoice.vehicleMake} {invoice.vehicleModel} - {invoice.vehiclePlateNumber || invoice.vehicleYear}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total:</span>
                    <span className="font-medium text-gray-900">{formatRupiah(invoice.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Terbayar:</span>
                    <span className="text-gray-600">{formatRupiah(invoice.paidAmount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
