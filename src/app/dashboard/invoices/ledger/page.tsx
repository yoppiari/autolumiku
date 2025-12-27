/**
 * Vehicle Ledger Page
 * Shows transaction flow for each vehicle: Beli > Masuk > Biaya > Jual > Bayar
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaArrowLeft, FaSearch, FaFilter, FaFileExport, FaCar, FaCheckCircle, FaClock, FaCircle } from 'react-icons/fa';
import { formatRupiah, formatDate } from '@/types/invoice';

interface VehicleLedgerItem {
  id: string;
  displayId: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  licensePlate: string | null;
  status: string;
  price: number;
  createdAt: string;
  publishedAt: string | null;
  // Invoice info (if sold)
  invoice?: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    paidAmount: number;
    status: string;
  } | null;
  // Flow stages
  flow: {
    purchased: { done: boolean; date: string | null };
    received: { done: boolean; date: string | null };
    costs: { done: boolean; amount: number };
    sold: { done: boolean; date: string | null };
    paid: { done: boolean; amount: number; percentage: number };
  };
  // Profit calculation
  profit?: {
    purchasePrice: number;
    totalCosts: number;
    sellingPrice: number;
    grossProfit: number;
    margin: number;
  };
}

interface LedgerStats {
  totalVehicles: number;
  inStock: number;
  sold: number;
  totalValue: number;
  totalProfit: number;
}

const FLOW_STEPS = [
  { key: 'purchased', label: 'Beli', icon: '📥', description: 'Pembelian' },
  { key: 'received', label: 'Masuk', icon: '🏪', description: 'Diterima' },
  { key: 'costs', label: 'Biaya', icon: '🔧', description: 'Reconditioning' },
  { key: 'sold', label: 'Jual', icon: '🧾', description: 'Invoice' },
  { key: 'paid', label: 'Bayar', icon: '💰', description: 'Pembayaran' },
];

export default function VehicleLedgerPage() {
  const [ledger, setLedger] = useState<VehicleLedgerItem[]>([]);
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userRoleLevel, setUserRoleLevel] = useState(30);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserRoleLevel(user.roleLevel || 30);
    }
    loadLedger();
  }, [statusFilter]);

  const loadLedger = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await fetch(`/api/v1/vehicle-ledger?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setLedger(data.data.vehicles || []);
        setStats(data.data.stats || null);
      }
    } catch (error) {
      console.error('Error loading ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canExport = userRoleLevel >= 70; // MANAGER and above

  // Filter by search
  const filteredLedger = searchQuery
    ? ledger.filter(v =>
        `${v.make} ${v.model} ${v.licensePlate} ${v.displayId}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ledger;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/invoices"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaArrowLeft className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Alur Transaksi Kendaraan</h1>
            <p className="text-sm text-gray-500 mt-1">Lacak alur transaksi dari pembelian hingga pembayaran</p>
          </div>
        </div>

        {canExport && (
          <button className="mt-4 md:mt-0 inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <FaFileExport />
            Export PDF
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Kendaraan</p>
          <p className="text-xl font-bold text-gray-900">{stats?.totalVehicles || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Stok</p>
          <p className="text-xl font-bold text-blue-600">{stats?.inStock || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Terjual</p>
          <p className="text-xl font-bold text-green-600">{stats?.sold || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Nilai Stok</p>
          <p className="text-lg font-bold text-gray-900">{formatRupiah(stats?.totalValue || 0)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Profit</p>
          <p className="text-lg font-bold text-emerald-600">{formatRupiah(stats?.totalProfit || 0)}</p>
        </div>
      </div>

      {/* Flow Legend */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <p className="text-xs font-medium text-gray-500 mb-3">ALUR TRANSAKSI</p>
        <div className="flex items-center justify-between overflow-x-auto">
          {FLOW_STEPS.map((step, idx) => (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="text-2xl mb-1">{step.icon}</span>
                <span className="text-xs font-medium text-gray-700">{step.label}</span>
                <span className="text-[10px] text-gray-400">{step.description}</span>
              </div>
              {idx < FLOW_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-200 mx-2 min-w-[20px]"></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Cari kendaraan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="AVAILABLE">Tersedia</option>
            <option value="BOOKED">Dipesan</option>
            <option value="SOLD">Terjual</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2 text-sm">Memuat data...</p>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="p-8 text-center">
            <FaCar className="text-gray-300 text-4xl mx-auto mb-3" />
            <p className="text-gray-500">Tidak ada data kendaraan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Kendaraan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Alur Transaksi</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Harga Jual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Terbayar</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLedger.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </p>
                        <p className="text-xs text-gray-500">
                          {vehicle.licensePlate || vehicle.displayId || '-'} {vehicle.color && `• ${vehicle.color}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {/* Flow Timeline */}
                      <div className="flex items-center justify-center gap-1">
                        {FLOW_STEPS.map((step, idx) => {
                          const flowData = vehicle.flow[step.key as keyof typeof vehicle.flow];
                          const isDone = typeof flowData === 'object' && 'done' in flowData ? flowData.done : false;
                          const isCurrent = !isDone && idx === FLOW_STEPS.findIndex(s => {
                            const fd = vehicle.flow[s.key as keyof typeof vehicle.flow];
                            return typeof fd === 'object' && 'done' in fd && !fd.done;
                          });

                          return (
                            <React.Fragment key={step.key}>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                  isDone
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                    ? 'bg-blue-500 text-white animate-pulse'
                                    : 'bg-gray-200 text-gray-400'
                                }`}
                                title={step.label}
                              >
                                {isDone ? (
                                  <FaCheckCircle className="text-[10px]" />
                                ) : isCurrent ? (
                                  <FaClock className="text-[10px]" />
                                ) : (
                                  <FaCircle className="text-[8px]" />
                                )}
                              </div>
                              {idx < FLOW_STEPS.length - 1 && (
                                <div
                                  className={`w-3 h-0.5 ${isDone ? 'bg-green-500' : 'bg-gray-200'}`}
                                ></div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatRupiah(vehicle.invoice?.grandTotal || vehicle.price)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {vehicle.invoice ? (
                        <div>
                          <span className="text-sm text-green-600 font-medium">
                            {formatRupiah(vehicle.invoice.paidAmount)}
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div
                              className="bg-green-500 h-1 rounded-full"
                              style={{ width: `${Math.min(100, (vehicle.invoice.paidAmount / vehicle.invoice.grandTotal) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        vehicle.status === 'SOLD'
                          ? 'bg-green-100 text-green-800'
                          : vehicle.status === 'BOOKED'
                          ? 'bg-yellow-100 text-yellow-800'
                          : vehicle.status === 'AVAILABLE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {vehicle.status === 'SOLD' ? 'Terjual' :
                         vehicle.status === 'BOOKED' ? 'Dipesan' :
                         vehicle.status === 'AVAILABLE' ? 'Tersedia' : vehicle.status}
                      </span>
                      {vehicle.invoice && (
                        <Link
                          href={`/dashboard/invoices/${vehicle.invoice.id}`}
                          className="block text-[10px] text-blue-600 hover:underline mt-1"
                        >
                          {vehicle.invoice.invoiceNumber}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
