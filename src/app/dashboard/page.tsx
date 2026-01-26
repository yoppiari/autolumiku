'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import { ROLE_LEVELS, getVisibleDashboardCards, getRoleLevelFromRole } from '@/lib/rbac';

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
  blog: {
    total: number;
    thisMonth: number;
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

interface RecentSale {
  id: string;
  displayId: string;
  make: string;
  model: string;
  year: number;
  price: number;
  soldAt: Date;
  soldBy: string;
  soldByName?: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  notInterested: number;
  converted: number;
  conversionRate: number;
}

interface LowStockItem {
  id: string;
  displayId: string;
  make: string;
  model: string;
  year: number;
  status: string;
  price: number;
}

export default function ShowroomDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingRecentSales, setLoadingRecentSales] = useState(true);
  const [loadingLowStock, setLoadingLowStock] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [userRoleLevel, setUserRoleLevel] = useState<number>(ROLE_LEVELS.SALES);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Compute roleLevel robustly from level or string role
      const roleLevel = parsedUser.roleLevel ??
        (parsedUser.role ? getRoleLevelFromRole(parsedUser.role) : ROLE_LEVELS.SALES);
      setUserRoleLevel(roleLevel);

      loadSubscription(parsedUser.tenantId);
      loadDashboardStats(parsedUser.tenantId);
      loadAnalytics(parsedUser.tenantId);
      loadKpiData(parsedUser.tenantId);
      loadRecentSales(parsedUser.tenantId);
      loadLowStockItems(parsedUser.tenantId);
      loadLeadMetrics(parsedUser.tenantId);
    }
  }, []);

  // Get visible cards based on user role
  const visibleCards = useMemo(() => getVisibleDashboardCards(userRoleLevel), [userRoleLevel]);

  // Check visibility helpers
  const canSeeKendaraan = visibleCards.includes('kendaraan');
  const canSeeInvoice = visibleCards.includes('invoice');
  const canSeeTim = visibleCards.includes('tim');
  const canSeeAnalytics = visibleCards.includes('analytics');
  const canSeeLeads = visibleCards.includes('leads');
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
      // Use 'today' for real-time dashboard overview
      const response = await fetch(`/api/v1/whatsapp-ai/analytics?tenantId=${tenantId}&range=today`);
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

  const loadKpiData = async (tenantId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/analytics/kpi?tenantId=${tenantId}`, {
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

  const loadRecentSales = async (tenantId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/vehicles?status=SOLD&limit=5&sortBy=updatedAt&sortOrder=desc&tenantId=${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentSales(data.data?.vehicles || []);
      }
    } catch (error) {
      console.error('Failed to load recent sales:', error);
    } finally {
      setLoadingRecentSales(false);
    }
  };

  const loadLowStockItems = async (tenantId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/vehicles?status=AVAILABLE&limit=20&sortBy=createdAt&sortOrder=asc&tenantId=${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Professional Logic: "Low Stock" in used car context means vehicles that have been in stock too long (> 60 days)
        const now = Date.now();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        const stagnantInventory = (data.data?.vehicles || []).filter((v: any) => {
          const createdAt = new Date(v.createdAt).getTime();
          return (now - createdAt) > sixtyDaysMs;
        }).slice(0, 5);

        setLowStockItems(stagnantInventory);
      }
    } catch (error) {
      console.error('Failed to load low stock items:', error);
    } finally {
      setLoadingLowStock(false);
    }
  };

  const loadLeadMetrics = async (tenantId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/leads?tenantId=${tenantId}&action=stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLeadStats(data.data || null);
      }
    } catch (error) {
      console.error('Failed to load lead metrics:', error);
    } finally {
      setLoadingLeads(false);
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

  // Format currency helper
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date helper
  const formatTanggal = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  // Stats card configuration with links and role visibility
  // Invoice feature is HIDDEN for all roles
  const statsConfig = [
    {
      key: 'kendaraan',
      title: 'Unit Available',
      value: stats?.vehicles.total || 0,
      subValue: stats?.vehicles.thisMonth || 0,
      subLabel: 'bulan ini',
      subColor: 'text-emerald-400',
      emoji: '🚗',
      gradient: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-900/20',
      href: '/dashboard/vehicles',
      colorClass: 'hover:border-blue-500 hover:bg-blue-900/30',
      iconBg: 'bg-blue-900/40 group-hover:bg-blue-600 border-2 border-blue-800 group-hover:border-blue-500',
      isAuthorized: canSeeKendaraan,
      isLoading: loadingStats
    },
    {
      key: 'leads',
      title: 'Total CRM Leads',
      value: leadStats?.total || 0,
      subValue: leadStats?.new || 0,
      subLabel: 'lead baru',
      subColor: 'text-amber-400',
      emoji: '📋',
      gradient: 'from-amber-500 to-amber-600',
      bgLight: 'bg-amber-900/20',
      href: '/dashboard/leads',
      colorClass: 'hover:border-amber-500 hover:bg-amber-900/30',
      iconBg: 'bg-amber-900/40 group-hover:bg-amber-600 border-2 border-amber-800 group-hover:border-amber-500',
      isAuthorized: canSeeLeads,
      isLoading: loadingLeads
    },
    {
      key: 'analytics',
      title: 'WhatsApp Activity',
      value: stats?.leads.active || 0,
      subValue: stats?.leads.today || 0,
      subLabel: 'chat hari ini',
      subColor: 'text-emerald-400',
      emoji: '💬',
      gradient: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-900/20',
      href: '/dashboard/whatsapp-ai/analytics',
      colorClass: 'hover:border-emerald-500 hover:bg-emerald-900/30',
      iconBg: 'bg-emerald-900/40 group-hover:bg-emerald-600 border-2 border-emerald-800 group-hover:border-emerald-500',
      isAuthorized: canSeeAnalytics,
      isLoading: loadingStats
    },
    {
      key: 'tim',
      title: 'Tim Showroom',
      value: stats?.team.total || 0,
      subValue: stats?.team.active || 0,
      subLabel: 'aktif',
      subColor: 'text-emerald-400',
      emoji: '👥',
      gradient: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-900/20',
      href: '/dashboard/users',
      colorClass: 'hover:border-violet-500 hover:bg-violet-900/30',
      iconBg: 'bg-violet-900/40 group-hover:bg-violet-600 border-2 border-violet-800 group-hover:border-violet-500',
      isAuthorized: canSeeTim,
      isLoading: loadingStats
    },
    {
      key: 'blog',
      title: 'Blog',
      value: stats?.blog.total || 0,
      subValue: stats?.blog.thisMonth || 0,
      subLabel: 'artikel',
      subColor: 'text-emerald-400',
      emoji: '📝',
      gradient: 'from-rose-500 to-rose-600',
      bgLight: 'bg-rose-900/20',
      href: '/dashboard/blog',
      colorClass: 'hover:border-rose-500 hover:bg-rose-900/30',
      iconBg: 'bg-rose-900/40 group-hover:bg-rose-600 border-2 border-rose-800 group-hover:border-rose-500',
      isAuthorized: canSeeBlog,
      isLoading: loadingStats
    },
  ];

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-90px)] -mt-2 !bg-[#1a1a1a] text-white" style={{ backgroundColor: '#1a1a1a', minHeight: '100vh', color: 'white' }}>
      {/* Welcome Header - Elegant Rich Modern */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-6 py-3 md:py-4 shadow-lg flex-shrink-0 ml-8 md:ml-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-2xl font-bold text-white truncate">
            {userRoleLevel >= ROLE_LEVELS.ADMIN ? 'Showroom Control Center' : 'Selamat Datang di Prima Mobil'}
          </h1>
          <p className="text-xs md:text-sm text-slate-300">
            {userRoleLevel >= ROLE_LEVELS.ADMIN ? `Admin Console for ${user?.tenantId ? 'Showroom' : 'Platform'}` : 'Dashboard manajemen showroom'}
          </p>
        </div>
        <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 ml-2 flex-shrink-0">
          <span className="w-1.5 md:w-2 h-1.5 md:h-2 bg-emerald-400 rounded-full mr-1 md:mr-2 animate-pulse"></span>
          Online
        </span>
      </div>

      {/* Stats Grid - Cards with Colored Icons (all cards shown, tooltip for unauthorized) */}
      <div className="grid gap-2 md:gap-3 flex-shrink-0 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {statsConfig.map((stat) => (
          <AuthorizedLink
            key={stat.key}
            href={stat.href}
            isAuthorized={stat.isAuthorized}
            className={`group bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] ${stat.isAuthorized ? 'hover:shadow-lg hover:shadow-black/40' : ''} transition-all p-2 md:p-3 ${stat.isAuthorized ? stat.colorClass : ''}`}
          >
            {/* Mobile: Vertical layout, Desktop: Horizontal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              {/* Icon - Top on mobile, Right on desktop */}
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all shadow-sm mx-auto md:mx-0 md:order-2 mb-2 md:mb-0 ${stat.iconBg}`}>
                <span className="text-xl md:text-3xl group-hover:scale-110 transition-transform">{stat.emoji}</span>
              </div>
              {/* Text - Below icon on mobile, Left on desktop */}
              <div className="flex-1 min-w-0 text-center md:text-left md:order-1">
                <p className="text-[9px] md:text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">
                  {stat.title}
                </p>
                {stat.isLoading ? (
                  <div className="h-5 md:h-6 w-8 md:w-10 bg-[#3a3a3a] animate-pulse rounded mt-1 mx-auto md:mx-0"></div>
                ) : (
                  <p className="text-xl md:text-2xl font-bold text-white">
                    {stat.value}
                  </p>
                )}
                {!stat.isLoading && (
                  <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5 truncate">
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
            <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] flex flex-col">
              <div className="px-4 py-3 border-b border-[#3a3a3a] flex items-center justify-between flex-shrink-0">
                <h3 className="text-base md:text-lg font-bold text-white">Analytics WhatsApp AI</h3>
                <Link href="/dashboard/whatsapp-ai/analytics" className="text-xs md:text-sm text-blue-400 hover:text-blue-300 font-medium">
                  Lihat Detail →
                </Link>
              </div>
              <div className="p-3 md:p-4">
                {/* Summary Cards - Quick Stats for Owner */}
                {loadingKpi ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-[#333] rounded-lg shadow p-3 md:p-4 animate-pulse">
                        <div className="h-3 bg-[#444] rounded w-20 mb-2"></div>
                        <div className="h-6 bg-[#444] rounded w-16 mb-1"></div>
                        <div className="h-3 bg-[#444] rounded w-24"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                    <div className="bg-[#333] rounded-lg shadow p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400">Total Penjualan</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{kpiData?.raw.totalSold || 0}</p>
                      <p className="text-[10px] md:text-xs text-green-400 mt-1">Unit terjual (Bulan ini)</p>
                    </div>
                    <div className="bg-[#333] rounded-lg shadow p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400">AI Response Rate</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-400">
                        {analytics?.overview.aiResponseRate || 0}%
                      </p>
                      <p className="text-[10px] md:text-xs text-gray-500 mt-1">Chat hari ini</p>
                    </div>
                    <div className="bg-[#333] rounded-lg shadow p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400">Today's Messages</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{analytics?.overview.totalMessages || 0}</p>
                      <p className="text-[10px] md:text-xs text-gray-500 mt-1">Pesan terproses</p>
                    </div>
                    <div className="bg-[#333] rounded-lg shadow p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400">Escalation Rate</p>
                      <p className="text-xl md:text-2xl font-bold text-purple-400">
                        {analytics?.overview.escalationRate || 0}%
                      </p>
                      <p className="text-[10px] md:text-xs text-gray-500 mt-1">Dialihkan ke tim</p>
                    </div>
                  </div>
                )}

                {loadingAnalytics ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-[#2a2a2a] rounded-lg shadow border border-[#3a3a3a] animate-pulse min-w-[220px] md:min-w-0 p-3 md:p-4">
                        <div className="h-4 bg-[#3a3a3a] rounded w-24 mb-4"></div>
                        <div className="flex justify-center py-4">
                          <div className="w-28 h-28 md:w-32 md:h-32 bg-[#3a3a3a] rounded-full"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {[1, 2, 3, 4, 5, 6].map((j) => (
                            <div key={j} className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-[#3a3a3a] rounded-full"></div>
                              <div className="h-3 bg-[#3a3a3a] rounded w-16"></div>
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
                      className="bg-[#2a2a2a] rounded-lg shadow p-3 md:p-4 hover:bg-[#333] transition-colors border border-[#3a3a3a] hover:border-blue-500 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                    >
                      <h4 className="text-sm font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                        <span className="text-lg">📊</span> Metrix Penjualan
                      </h4>

                      {/* Main Donut Chart - Penjualan Showroom */}
                      <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                        <div className="relative w-28 h-28 md:w-32 md:h-32">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3a3a3a" strokeWidth="3.5" />
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
                            <span className="text-2xl md:text-3xl font-bold text-blue-500">{kpiData?.penjualanShowroom || 0}%</span>
                            <span className="text-[8px] md:text-[10px] text-gray-400 font-medium">Target Bulanan</span>
                          </div>
                        </div>
                      </div>

                      {/* Indicators List */}
                      <div className="space-y-1.5 md:space-y-2 border-t border-[#3a3a3a] pt-2 md:pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">ATV</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.atv || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-purple-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Turnover</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.inventoryTurnover || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Showroom</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.penjualanShowroom || 0}%</span>
                        </div>
                      </div>

                      {/* Footer Note */}
                      <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-[#3a3a3a]">
                        <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#60a5fa' }}>
                          Target: 20% inventory sold per month (2-5 vehicles)
                        </p>
                      </div>
                    </Link>

                    {/* Metrix Pelanggan */}
                    <Link
                      href="/dashboard/whatsapp-ai/analytics"
                      className="bg-[#2a2a2a] rounded-lg shadow p-3 md:p-4 hover:bg-[#333] transition-colors border border-[#3a3a3a] hover:border-blue-500 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                    >
                      <h4 className="text-sm font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                        <span className="text-lg">👥</span> Metrix Pelanggan
                      </h4>

                      {/* Main Donut Chart - NPS (Net Promoter Score) */}
                      <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                        <div className="relative w-28 h-28 md:w-32 md:h-32">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3a3a3a" strokeWidth="3.5" />
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
                            <span className="text-2xl md:text-3xl font-bold text-amber-500">{kpiData?.nps || 0}%</span>
                            <span className="text-[8px] md:text-[10px] text-gray-400 font-medium">NPS Score</span>
                          </div>
                        </div>
                      </div>

                      {/* Indicators List */}
                      <div className="space-y-1.5 md:space-y-2 border-t border-[#3a3a3a] pt-2 md:pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-teal-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Retention</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.customerRetention || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-amber-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">NPS Score</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.nps || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-cyan-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Conversion</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.raw?.leadConversion || 0}%</span>
                        </div>
                      </div>

                      {/* Footer Note */}
                      <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-[#3a3a3a]">
                        <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#fcd34d' }}>
                          Target: NPS &gt; 50% (Excellent)
                        </p>
                      </div>
                    </Link>

                    {/* Metrix Operasional */}
                    <Link
                      href="/dashboard/whatsapp-ai/analytics"
                      className="bg-[#2a2a2a] rounded-lg shadow p-3 md:p-4 hover:bg-[#333] transition-colors border border-[#3a3a3a] hover:border-blue-500 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                    >
                      <h4 className="text-sm font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                        <span className="text-lg">⚙️</span> Metrix Operasional
                      </h4>

                      {/* Main Donut Chart - Overall Efficiency */}
                      <div className="flex items-center justify-center py-2 md:py-3 mb-2 md:mb-3">
                        <div className="relative w-28 h-28 md:w-32 md:h-32">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3a3a3a" strokeWidth="3.5" />
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
                            <span className="text-2xl md:text-3xl font-bold text-violet-500">{kpiData?.efficiency || 0}%</span>
                            <span className="text-[8px] md:text-[10px] text-gray-600 font-medium">Efficiency</span>
                          </div>
                        </div>
                      </div>

                      {/* Indicators List */}
                      <div className="space-y-1.5 md:space-y-2 border-t border-[#3a3a3a] pt-2 md:pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-indigo-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Sales/Emp</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.salesPerEmployee || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-violet-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Efficiency</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.efficiency || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-rose-500"></span>
                            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Velocity</span>
                          </div>
                          <span className="text-[10px] md:text-xs font-bold text-white">{kpiData?.inventoryTurnover || 0}%</span>
                        </div>
                      </div>

                      {/* Footer Note */}
                      <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-[#3a3a3a]">
                        <p className="text-[7px] md:text-[8px] leading-snug" style={{ color: '#a78bfa' }}>
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

          {/* Recent Sales Activity */}
          <div className="mt-3 md:mt-4">
            <div className="bg-[#2a2a2a] rounded-lg shadow p-3 md:p-4 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>🚗</span> Recent Sales
                </h4>
                <Link href="/dashboard/vehicles?status=SOLD" className="text-[9px] md:text-[10px] text-blue-400 hover:text-blue-300 font-medium">
                  View All →
                </Link>
              </div>

              {loadingRecentSales ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 bg-[#3a3a3a] rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-[#3a3a3a] rounded w-24 mb-1"></div>
                        <div className="h-2 bg-[#3a3a3a] rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentSales.length > 0 ? (
                <div className="space-y-2">
                  {recentSales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center gap-2 md:gap-3 p-2 rounded-lg hover:bg-[#333] transition-colors border border-[#3a3a3a]">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs md:text-sm font-bold">🚙</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs font-semibold text-white truncate">
                          {sale.make} {sale.model} ({sale.year})
                        </p>
                        <p className="text-[8px] md:text-[10px] text-gray-400 truncate">
                          {formatRupiah(sale.price)} • {formatTanggal(sale.soldAt)}
                        </p>
                      </div>
                      <div className="text-[8px] md:text-[10px] text-gray-500 flex-shrink-0">
                        {sale.soldByName || 'Staff'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 md:py-6">
                  <p className="text-[10px] md:text-xs text-gray-500">Belum ada penjualan</p>
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="mt-3 md:mt-4">
            <div className="bg-[#2a2a2a] rounded-lg shadow p-3 md:p-4 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>⚠️</span> Low Stock Alerts
                </h4>
                <Link href="/dashboard/vehicles?status=AVAILABLE" className="text-[9px] md:text-[10px] text-blue-400 hover:text-blue-300 font-medium">
                  View All →
                </Link>
              </div>

              {loadingLowStock ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 bg-[#3a3a3a] rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-[#3a3a3a] rounded w-24 mb-1"></div>
                        <div className="h-2 bg-[#3a3a3a] rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : lowStockItems.length > 0 ? (
                <div className="space-y-2">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 md:gap-3 p-2 rounded-lg hover:bg-amber-900/20 transition-colors border border-amber-900/30">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs md:text-sm font-bold">📦</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs font-semibold text-white truncate">
                          {item.make} {item.model} ({item.year})
                        </p>
                        <p className="text-[8px] md:text-[10px] text-gray-400 truncate">
                          {formatRupiah(item.price)} • {item.displayId}
                        </p>
                      </div>
                      <div className="px-2 py-0.5 md:px-2.5 md:py-1 bg-amber-900/40 text-amber-200 text-[8px] md:text-[10px] font-semibold rounded-full flex-shrink-0">
                        Ready
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8 bg-[#333]/50 rounded-lg border border-dashed border-[#444]">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl md:text-2xl">✅</span>
                  </div>
                  <p className="text-xs md:text-sm font-bold text-white">Stok aman</p>
                  <p className="text-[10px] md:text-xs text-gray-500 mt-1">Unit tersedia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
