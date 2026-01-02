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

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      loadAnalytics();
      loadInsights(user.tenantId);
    }
  }, [router, timeRange]);

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
    }).format(amount);
  };

  const intentColors: Record<string, string> = {
    greeting: '#22c55e',
    vehicle: '#3b82f6',
    price: '#a855f7',
    general: '#f59e0b',
    closing: '#ef4444',
    unknown: '#6b7280',
  };

  return (
    <div className="p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/whatsapp-ai" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mb-4">
          ← Back
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Intelligence Dashboard</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Prima Mobil Management System</p>
          </div>
          {insights.length > 0 && (
            <div className="flex-1 max-w-md bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                <span className="text-6xl">🧠</span>
              </div>
              <h3 className="text-xs font-black flex items-center gap-2 mb-2 uppercase tracking-widest">
                <span>⚡</span> Smart Insight
              </h3>
              <p className="text-xs font-bold text-blue-50 line-clamp-2 leading-relaxed">
                {insights[0]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-md border-b border-gray-200 mb-8 -mx-4 px-4 md:mx-0 md:px-0">
        <nav className="flex gap-2 py-3" aria-label="Tabs">
          <button
            onClick={() => setActiveDepartment('sales')}
            className={`flex-1 md:flex-none py-2.5 px-6 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap ${activeDepartment === 'sales'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
              : 'text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent'
              }`}
          >
            📊 SALES DASHBOARD
          </button>
          <button
            onClick={() => setActiveDepartment('whatsapp')}
            className={`flex-1 md:flex-none py-2.5 px-6 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap ${activeDepartment === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105'
              : 'text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent'
              }`}
          >
            💬 WHATSAPP AI
          </button>
        </nav>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-xl"></div>
          <p className="mt-4 text-gray-500 font-black text-xs uppercase tracking-widest">Calculating Metrics...</p>
        </div>
      ) : (
        <>
          {activeDepartment === 'sales' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              {/* Sales Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform"><span className="text-6xl">💰</span></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Penjualan</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-black text-gray-900">{salesStats?.totalSales || 0}</p>
                    <span className="text-xs font-black text-emerald-600 underline decoration-2">UNITS</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform"><span className="text-6xl">💵</span></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Revenue</p>
                  <p className="text-2xl font-black text-blue-600 truncate">{formatRupiah(salesStats?.totalRevenue || 0)}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform"><span className="text-6xl">📦</span></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inventory</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-black text-gray-900">{kpiData?.raw.totalInventory || 0}</p>
                    <span className="text-xs font-black text-gray-400">PCS</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform"><span className="text-6xl">✨</span></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Top Brand</p>
                  <p className="text-2xl font-black text-purple-600 truncate">{salesStats?.topBrands?.[0]?.brand || '-'}</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  {[
                    { title: 'Sales Efficiency', value: kpiData?.penjualanShowroom || 0, color: 'blue', list: [{ l: 'ATV', v: kpiData?.atv || 0 }, { l: 'Turnover', v: kpiData?.inventoryTurnover || 0 }] },
                    { title: 'Customer Health', value: kpiData?.nps || 0, color: 'emerald', list: [{ l: 'Retention', v: kpiData?.customerRetention || 0 }, { l: 'Conversion', v: kpiData?.raw.leadConversion || 0 }] }
                  ].map((kpi, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{kpi.title}</h4>
                      <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                            <circle cx="18" cy="18" r="16" fill="none" stroke={kpi.color === 'blue' ? '#3b82f6' : '#10b981'} strokeWidth="4" strokeDasharray={`${kpi.value} 100`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-black text-lg">{kpi.value}%</div>
                        </div>
                        <div className="flex-1 space-y-3">
                          {kpi.list.map((item, j) => (
                            <div key={j}>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight">{item.l}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500/50" style={{ width: `${item.v}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black">{item.v}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Monthly Sales Trend</h4>
                      <p className="text-[10px] text-gray-400 font-bold">Unit sales volume per month</p>
                    </div>
                  </div>
                  <div className="h-60 flex items-end gap-3 px-2">
                    {salesStats?.monthlySales?.map((m, i) => {
                      const max = Math.max(...salesStats.monthlySales.map(x => x.count), 1);
                      const h = (m.count / max) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all group-hover:scale-x-110 relative" style={{ height: `${Math.max(h, 5)}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap z-30">{m.count} UNITS</div>
                          </div>
                          <span className="text-[9px] font-black text-gray-400 uppercase">{m.month.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                <div className="text-center md:text-left">
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight underline decoration-blue-500 decoration-4 underline-offset-8">Detailed Intelligence Modules</h2>
                </div>
                {[
                  {
                    title: 'Sales & Revenue', reports: [
                      { id: 'one-page-sales', name: 'Executive Report', desc: 'Financial metrics & brand distribution', icon: '💰', href: '/dashboard/whatsapp-ai/analytics/reports/one-page-sales' },
                      { id: 'total-sales', name: 'Total Penjualan', desc: 'Accumulated volume analysis', icon: '📊', href: '/dashboard/whatsapp-ai/analytics/reports/total-sales' },
                      { id: 'sales-trends', name: 'Tren Penjualan', desc: 'Comparison vs last period', icon: '📈', href: '/dashboard/whatsapp-ai/analytics/reports/sales-trends' },
                      { id: 'sales-metrics', name: 'Metrik Sales', desc: 'Conversion & ATV performance', icon: '📐', href: '/dashboard/whatsapp-ai/analytics/reports/sales-metrics' },
                    ]
                  },
                  {
                    title: 'Inventory & Operations', reports: [
                      { id: 'total-inventory', name: 'Stock Report', desc: 'Current vehicle inventory status', icon: '📦', href: '/dashboard/whatsapp-ai/analytics/reports/total-inventory' },
                      { id: 'average-price', name: 'Price Audit', desc: 'Purchase vs Selling price trends', icon: '💵', href: '/dashboard/whatsapp-ai/analytics/reports/average-price' },
                      { id: 'low-stock-alert', name: 'Stock Alerts', desc: 'Critical inventory levels', icon: '⚠️', href: '/dashboard/whatsapp-ai/analytics/reports/low-stock-alert' },
                      { id: 'staff-performance', name: 'Staff Performance', desc: 'Individual sales efficiency', icon: '🏆', href: '/dashboard/whatsapp-ai/analytics/reports/staff-performance' },
                    ]
                  },
                  {
                    title: 'WhatsApp AI Intelligence', reports: [
                      { id: 'whatsapp-ai', name: 'AI Analytics', desc: 'Chatbot effectiveness review', icon: '🤖', href: '/dashboard/whatsapp-ai/analytics/reports/whatsapp-ai' },
                      { id: 'operational-metrics', name: 'Ops Metrics', desc: 'Response & resolution times', icon: '⚙️', href: '/dashboard/whatsapp-ai/analytics/reports/operational-metrics' },
                      { id: 'customer-metrics', name: 'Customer Behavior', desc: 'Intent & engagement analysis', icon: '👥', href: '/dashboard/whatsapp-ai/analytics/reports/customer-metrics' },
                    ]
                  }
                ].map((section, idx) => (
                  <div key={idx} className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{section.title}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {section.reports.map(r => (
                        <ReportCard key={r.id} report={r} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDepartment === 'whatsapp' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              {whatsappAnalytics ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { l: 'Total Chats', v: whatsappAnalytics.overview.totalConversations, c: 'blue' },
                      { l: 'Messages', v: whatsappAnalytics.overview.totalMessages, c: 'indigo' },
                      { l: 'AI Rate', v: `${whatsappAnalytics.overview.aiResponseRate}%`, c: 'emerald' },
                      { l: 'Accuracy', v: `${whatsappAnalytics.performance.aiAccuracy}%`, c: 'purple' }
                    ].map((m, i) => (
                      <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full bg-${m.c}-500/50`}></div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{m.l}</p>
                        <p className="text-3xl font-black text-gray-900">{m.v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Intent Distribution</h4>
                      <div className="space-y-4">
                        {whatsappAnalytics.intentBreakdown?.slice(0, 5).map((item, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                              <span>{item.intent}</span>
                              <span>{item.percentage}%</span>
                            </div>
                            <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500/40" style={{ width: `${item.percentage}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col justify-center text-center">
                      <div className="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💬</div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">AI Execution Report</h3>
                      <p className="text-sm text-gray-500 font-bold leading-relaxed">
                        Current resolution rate is <span className="text-emerald-600 underline underline-offset-4 decoration-2">{whatsappAnalytics.performance.resolutionRate}%</span>.
                        The AI handles communication at an average speed of {whatsappAnalytics.overview.avgResponseTime}s.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-3xl p-20 border-2 border-dashed border-gray-200 text-center">
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No Artificial Intelligence Data Available</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: { id: string; name: string; desc: string; icon: string; href?: string } }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between h-48">
      <div>
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-blue-50 transition-colors">{report.icon}</div>
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">{report.name}</h4>
        <p className="text-[10px] text-gray-400 font-bold leading-relaxed line-clamp-2">{report.desc}</p>
      </div>
      {report.href ? (
        <Link href={report.href} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
          Analyze Data ➔
        </Link>
      ) : (
        <div className="w-full py-2.5 rounded-xl bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center">Inactive</div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    }>
      <AnalyticsPageInternal />
    </Suspense>
  );
}
