'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import { ROLE_LEVELS, getVisibleDashboardCards } from '@/lib/rbac';

// Tooltip wrapper component for unauthorized access
interface AuthorizedLinkProps {
  href: string;
  isAuthorized: boolean;
  children: React.ReactNode;
  className?: string;
}

function AuthorizedLink({ href, isAuthorized, children, className = '' }: AuthorizedLinkProps) {
  if (isAuthorized) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div
      className={`relative group/auth cursor-not-allowed ${className}`}
      style={{ opacity: 0.6 }}
      onClick={(e) => e.preventDefault()}
    >
      {children}
      {/* Tooltip */}
      <div className="absolute z-50 hidden group-hover/auth:block bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg">
        You are not authorized
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}

interface DashboardStats {
  vehicles: {
    total: number;
    thisMonth: number;
  };
  leads: {
    active: number;
    today: number;
  };
  team: {
    total: number;
    active: number;
  };
  sales: {
    thisMonth: number;
    lastMonth: number;
    changePercent: number;
  };
}

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

interface AnalyticsData {
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
  intentBreakdown: Array<{
    intent: string;
    count: number;
    percentage: number;
  }>;
  staffActivity: Array<{
    staffPhone: string;
    commandCount: number;
    successRate: number;
    lastActive: string;
  }>;
}

export default function ShowroomDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [userRoleLevel, setUserRoleLevel] = useState<number>(ROLE_LEVELS.SALES);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setUserRoleLevel(parsedUser.roleLevel || ROLE_LEVELS.SALES);
      loadSubscription(parsedUser.tenantId);
      loadDashboardStats(parsedUser.tenantId);
      loadAnalytics(parsedUser.tenantId);
      loadKpiData();
    }
  }, []);

  // Get visible cards based on user role
  const visibleCards = useMemo(() => getVisibleDashboardCards(userRoleLevel), [userRoleLevel]);

  // Check visibility helpers
  const canSeeKendaraan = visibleCards.includes('kendaraan');
  const canSeeInvoice = visibleCards.includes('invoice');
  const canSeeTim = visibleCards.includes('tim');
  const canSeeAnalytics = visibleCards.includes('analytics');
  const canSeeBlog = visibleCards.includes('blog');

  const loadSubscription = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/subscription`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data?.subscription || null);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadDashboardStats = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/dashboard/stats?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadAnalytics = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/whatsapp-ai/analytics?tenantId=${tenantId}&range=week`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.data || null);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadKpiData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/analytics/kpi', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setKpiData(data.data);
      }
    } catch (error) {
      console.error('Failed to load KPI data:', error);
    } finally {
      setLoadingKpi(false);
    }
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

  // Get intent display name
  const getIntentName = (intent: string) => {
    const names: Record<string, string> = {
      greeting: 'Greeting',
      vehicle: 'Vehicle',
      price: 'Price',
      general: 'General',
      closing: 'Closing',
    };
    return names[intent.toLowerCase()] || intent;
  };

  // Stats card configuration with links and role visibility
  // Invoice feature is HIDDEN for all roles
  const statsConfig = [
    {
      key: 'kendaraan',
      title: 'Total Kendaraan',
      value: stats?.vehicles.total || 0,
      subValue: stats?.vehicles.thisMonth || 0,
      subLabel: 'bulan ini',
      subColor: 'text-emerald-600',
      emoji: '🚗',
      gradient: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      href: '/dashboard/vehicles',
      colorClass: 'hover:border-blue-400 hover:bg-blue-50/50',
      iconBg: 'bg-blue-100 group-hover:bg-blue-500 border-2 border-blue-200 group-hover:border-blue-500',
      isAuthorized: canSeeKendaraan,
    },
    {
      key: 'analytics',
      title: 'Analytics',
      value: stats?.leads.active || 0,
      subValue: stats?.leads.today || 0,
      subLabel: 'chat hari ini',
      subColor: 'text-emerald-600',
      emoji: '📊',
      gradient: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      href: '/dashboard/whatsapp-ai/analytics',
      colorClass: 'hover:border-emerald-400 hover:bg-emerald-50/50',
      iconBg: 'bg-emerald-100 group-hover:bg-emerald-500 border-2 border-emerald-200 group-hover:border-emerald-500',
      isAuthorized: canSeeAnalytics,
    },
    {
      key: 'tim',
      title: 'Tim Showroom',
      value: stats?.team.total || 0,
      subValue: stats?.team.active || 0,
      subLabel: 'aktif',
      subColor: 'text-emerald-600',
      emoji: '👥',
      gradient: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-50',
      href: '/dashboard/users',
      colorClass: 'hover:border-violet-400 hover:bg-violet-50/50',
      iconBg: 'bg-violet-100 group-hover:bg-violet-500 border-2 border-violet-200 group-hover:border-violet-500',
      isAuthorized: canSeeTim,
    },
    {
      key: 'blog',
      title: 'Blog',
      value: 0, // TODO: Add blog stats
      subValue: 0,
      subLabel: 'artikel',
      subColor: 'text-emerald-600',
      emoji: '📝',
      gradient: 'from-rose-500 to-rose-600',
      bgLight: 'bg-rose-50',
      href: '/dashboard/blog',
      colorClass: 'hover:border-rose-400 hover:bg-rose-50/50',
      iconBg: 'bg-rose-100 group-hover:bg-rose-500 border-2 border-rose-200 group-hover:border-rose-500',
      isAuthorized: canSeeBlog,
    },
  ];

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-90px)] -mt-2">
      {/* Welcome Header - Elegant Rich Modern */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-6 py-3 md:py-4 shadow-lg flex-shrink-0 ml-8 md:ml-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-2xl font-bold text-white truncate">
            Selamat Datang di Prima Mobil
          </h1>
          <p className="text-xs md:text-sm text-slate-300">Dashboard manajemen showroom</p>
        </div>
        <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 ml-2 flex-shrink-0">
          <span className="w-1.5 md:w-2 h-1.5 md:h-2 bg-emerald-400 rounded-full mr-1 md:mr-2 animate-pulse"></span>
          Online
        </span>
      </div>

      {/* Stats Grid - Cards with Colored Icons (all cards shown, tooltip for unauthorized) */}
      <div className="grid gap-2 md:gap-3 flex-shrink-0 grid-cols-2 md:grid-cols-5">
        {statsConfig.map((stat) => (
          <AuthorizedLink
            key={stat.key}
            href={stat.href}
            isAuthorized={stat.isAuthorized}
            className={`group bg-white rounded-xl border border-gray-200 ${stat.isAuthorized ? 'hover:shadow-lg' : ''} transition-all p-2 md:p-3 ${stat.isAuthorized ? stat.colorClass : ''}`}
          >
            {/* Mobile: Vertical layout, Desktop: Horizontal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              {/* Icon - Top on mobile, Right on desktop */}
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all shadow-sm mx-auto md:mx-0 md:order-2 mb-2 md:mb-0 ${stat.iconBg}`}>
                <span className="text-xl md:text-3xl group-hover:scale-110 transition-transform">{stat.emoji}</span>
              </div>
              {/* Text - Below icon on mobile, Left on desktop */}
              <div className="flex-1 min-w-0 text-center md:text-left md:order-1">
                <p className="text-[9px] md:text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">
                  {stat.title}
                </p>
                {loadingStats ? (
                  <div className="h-5 md:h-6 w-8 md:w-10 bg-gray-100 animate-pulse rounded mt-1 mx-auto md:mx-0"></div>
                ) : (
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                )}
                {!loadingStats && (
                  <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 truncate">
                    <span className={stat.subColor}>
                      +{stat.subValue}
                    </span>
                    {' '}{stat.subLabel}
                  </p>
                )}
              </div>
            </div>
          </AuthorizedLink>
        ))}
      </div>

      {/* Main Content - Analytics & Subscription Row */}
      <div className={`grid gap-2 flex-shrink-0 ${canSeeAnalytics ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Left: Analytics (MANAGER+ only) - now links to WhatsApp AI analytics */}
        {canSeeAnalytics && (
        <div className="md:col-span-2 order-2 md:order-1">
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base md:text-lg font-bold text-gray-800">Analytics WhatsApp AI</h3>
              <Link href="/dashboard/whatsapp-ai/analytics" className="text-xs md:text-sm text-blue-600 hover:text-blue-800 font-medium">
                Lihat Detail →
              </Link>
            </div>
            <div className="p-3 md:p-4">
              {/* Summary Cards - Quick Stats for Owner */}
              {loadingKpi ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-3 md:p-4 animate-pulse">
                      <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                  <div className="bg-white rounded-lg shadow p-3 md:p-4">
                    <p className="text-xs md:text-sm text-gray-500">Total Penjualan</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{kpiData?.raw.totalSold || 0}</p>
                    <p className="text-[10px] md:text-xs text-green-600 mt-1">Unit terjual</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 md:p-4">
                    <p className="text-xs md:text-sm text-gray-500">Total Revenue</p>
                    <p className="text-xl md:text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(kpiData?.raw.totalRevenue || 0)}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">Omzet keseluruhan</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 md:p-4">
                    <p className="text-xs md:text-sm text-gray-500">Total Inventory</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{kpiData?.raw.totalInventory || 0}</p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">Stok tersedia</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 md:p-4">
                    <p className="text-xs md:text-sm text-gray-500">Avg Price</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-600">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(kpiData?.raw.avgPrice || 0)}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">Per unit</p>
                  </div>
                </div>
              )}

              {loadingAnalytics ? (
                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-lg shadow border border-gray-200 animate-pulse min-w-[220px] md:min-w-0 p-3 md:p-4">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                      <div className="flex justify-center py-4">
                        <div className="w-28 h-28 md:w-32 md:h-32 bg-gray-200 rounded-full"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {[1, 2, 3, 4, 5, 6].map((j) => (
                          <div key={j} className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                            <div className="h-3 bg-gray-200 rounded w-16"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible scrollbar-hide">
                  {/* Metrix Penjualan */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                      <span className="text-lg">📊</span> Metrix Penjualan
                    </h4>

                    {/* Main Donut Chart - Penjualan Showroom */}
                    <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                      <div className="relative w-28 h-28 md:w-32 md:h-32">
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
                          <span className="text-2xl md:text-3xl font-bold text-blue-600">{kpiData?.penjualanShowroom || 0}%</span>
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">Target Bulanan</span>
                        </div>
                      </div>
                    </div>

                    {/* Indicators List */}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500"></span>
                          <span className="text-[10px] md:text-xs text-gray-700 font-medium">Penjualan Showroom</span>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.penjualanShowroom || 0}%</span>
                      </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                      <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#3b82f6' }}>
                        Target: 20% inventory sold per month (2-5 vehicles)
                      </p>
                    </div>
                  </Link>

                  {/* Metrix Pelanggan */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                      <span className="text-lg">👥</span> Metrix Pelanggan
                    </h4>

                    {/* Main Donut Chart - NPS (Net Promoter Score) */}
                    <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                      <div className="relative w-28 h-28 md:w-32 md:h-32">
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
                          <span className="text-2xl md:text-3xl font-bold text-amber-600">{kpiData?.nps || 0}%</span>
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">NPS Score</span>
                        </div>
                      </div>
                    </div>

                    {/* Indicators List */}
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
                          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-amber-500"></span>
                          <span className="text-[10px] md:text-xs text-gray-700 font-medium">NPS (Satisfaction)</span>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.nps || 0}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-cyan-500"></span>
                          <span className="text-[10px] md:text-xs text-gray-700 font-medium">Lead Conversion</span>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.raw?.leadConversion || 0}%</span>
                      </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                      <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#f59e0b' }}>
                        Target: NPS &gt; 50% (Excellent)
                      </p>
                    </div>
                  </Link>

                  {/* Metrix Operasional */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                      <span className="text-lg">⚙️</span> Metrix Operasional
                    </h4>

                    {/* Main Donut Chart - Overall Efficiency */}
                    <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                      <div className="relative w-28 h-28 md:w-32 md:h-32">
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
                          <span className="text-2xl md:text-3xl font-bold text-violet-600">{kpiData?.efficiency || 0}%</span>
                          <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">Efficiency</span>
                        </div>
                      </div>
                    </div>

                    {/* Indicators List */}
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
                          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-violet-500"></span>
                          <span className="text-[10px] md:text-xs text-gray-700 font-medium">Overall Efficiency</span>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.efficiency || 0}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-rose-500"></span>
                          <span className="text-[10px] md:text-xs text-gray-700 font-medium">Inventory Velocity</span>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-gray-900">{kpiData?.inventoryTurnover || 0}%</span>
                      </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                      <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#8b5cf6' }}>
                        Target: 2 vehicles/employee/month
                      </p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Right: Subscription - Show first on mobile */}
        <div className={canSeeAnalytics ? "md:col-span-1 order-1 md:order-2" : "order-1"}>
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>
    </div>
  );
}
