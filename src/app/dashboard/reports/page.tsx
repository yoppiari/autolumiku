/**
 * Reports Dashboard
 * Comprehensive reporting page with all 14 report types
 * Path: /dashboard/reports
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ReportType = {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'sales' | 'whatsapp' | 'inventory' | 'performance';
};

type Period = '7d' | '30d' | '90d' | '180d' | '1y';

const REPORT_TYPES: ReportType[] = [
    // Sales Reports
    {
        id: 'sales-report',
        name: 'Laporan Penjualan Lengkap',
        description: 'Sales summary + staff rankings + sales by brand',
        icon: '📊',
        category: 'sales',
    },
    {
        id: 'sales-trends',
        name: 'Tren Penjualan',
        description: 'Daily sales trends over selected period',
        icon: '📈',
        category: 'sales',
    },
    {
        id: 'recent-sales',
        name: 'Penjualan Terkini',
        description: 'Detailed list of recent sales transactions',
        icon: '🔄',
        category: 'sales',
    },
    {
        id: 'total-sales',
        name: 'Total Penjualan',
        description: 'Total units sold summary',
        icon: '🎯',
        category: 'sales',
    },
    {
        id: 'total-revenue',
        name: 'Total Revenue',
        description: 'Total revenue summary',
        icon: '💰',
        category: 'sales',
    },
    {
        id: 'sales-summary',
        name: 'Ringkasan Penjualan',
        description: 'Quick overview of sales performance',
        icon: '📋',
        category: 'sales',
    },

    // Performance & KPIs
    {
        id: 'sales-metrics',
        name: 'Metrik Penjualan',
        description: 'KPIs + inventory metrics',
        icon: '📐',
        category: 'performance',
    },
    {
        id: 'operational-metrics',
        name: 'Metrik Operasional',
        description: 'Operational KPIs + efficiency',
        icon: '⚙️',
        category: 'performance',
    },
    {
        id: 'staff-performance',
        name: 'Performa Staff',
        description: 'Individual staff rankings + sales details',
        icon: '🏆',
        category: 'performance',
    },

    // Inventory
    {
        id: 'total-inventory',
        name: 'Total Inventory',
        description: 'Current stock count',
        icon: '📦',
        category: 'inventory',
    },
    {
        id: 'low-stock-alert',
        name: 'Peringatan Stok',
        description: 'Inventory warnings + slow-moving stock',
        icon: '⚠️',
        category: 'inventory',
    },
    {
        id: 'average-price',
        name: 'Rata-rata Harga',
        description: 'Average price comparison (sold vs stock)',
        icon: '💵',
        category: 'inventory',
    },
    {
        id: 'management-insights',
        name: 'Management Insights',
        description: 'AI-powered business analysis and strategic advice',
        icon: '🧠',
        category: 'performance',
    },
];

const PERIODS = [
    { value: '7d', label: '7 Hari' },
    { value: '30d', label: '1 Bulan' },
    { value: '90d', label: '3 Bulan' },
    { value: '180d', label: '6 Bulan' },
    { value: '1y', label: '1 Tahun' },
];

export default function ReportsPage() {
    const router = useRouter();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (reportId: string, format: 'pdf' | 'excel') => {
        try {
            setDownloading(`${reportId}-${format}`);
            const token = localStorage.getItem('authToken');

            if (!token) {
                alert('Token tidak ditemukan. Silakan login kembali.');
                router.push('/login');
                return;
            }

            const response = await fetch(
                `/api/v1/reports/${reportId}?period=${selectedPeriod}&format=${format}`,
                {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${reportId}-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Gagal download: ${errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Terjadi kesalahan saat download report');
        } finally {
            setDownloading(null);
        }
    };

    const filteredReports = activeCategory === 'all'
        ? REPORT_TYPES
        : REPORT_TYPES.filter((r) => r.category === activeCategory);

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <div className="mb-6">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mb-2"
                >
                    ← Back to Dashboard
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            📊 Comprehensive Reports
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Download detailed business reports in PDF or Excel format
                        </p>
                    </div>

                    {/* Period Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium">Periode:</span>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value as Period)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {PERIODS.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-200 pb-4">
                {[
                    { value: 'all', label: 'Semua', icon: '📑' },
                    { value: 'sales', label: 'Sales', icon: '💵' },
                    { value: 'performance', label: 'Performa', icon: '🎯' },
                    { value: 'inventory', label: 'Inventory', icon: '📦' },
                ].map((cat) => (
                    <button
                        key={cat.value}
                        onClick={() => setActiveCategory(cat.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <span className="mr-2">{cat.icon}</span>
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map((report) => (
                    <div
                        key={report.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col h-full"
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <span className="text-3xl">{report.icon}</span>
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-gray-900 mb-1">
                                    {report.name}
                                </h3>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {report.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-auto pt-2">
                            <button
                                onClick={() => handleDownload(report.id, 'pdf')}
                                disabled={!!downloading}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${downloading === `${report.id}-pdf`
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                    }`}
                            >
                                {downloading === `${report.id}-pdf` ? (
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <>
                                        <span className="text-lg">📄</span> PDF
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => handleDownload(report.id, 'excel')}
                                disabled={!!downloading}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${downloading === `${report.id}-excel`
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                    }`}
                            >
                                {downloading === `${report.id}-excel` ? (
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <>
                                        <span className="text-lg">📊</span> Excel
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Info Footer */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">
                            Tentang Reports
                        </h4>
                        <ul className="text-xs text-blue-800 space-y-1">
                            <li>
                                • Semua report menggunakan data real-time dari database
                            </li>
                            <li>
                                • Pilih periode untuk menyesuaikan rentang waktu laporan
                            </li>
                            <li>
                                • Format PDF professional dengan chart dan tabel
                            </li>
                            <li>
                                • Format Excel untuk analisis data lebih lanjut
                            </li>
                            <li>
                                • Report dapat di-share dengan management atau stakeholder
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
