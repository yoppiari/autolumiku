'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';

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
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadSubscription(parsedUser.tenantId);
      loadDashboardStats(parsedUser.tenantId);
      loadAnalytics(parsedUser.tenantId);
    }
  }, []);

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

  // Stats card configuration with links
  const statsConfig = [
    {
      title: 'Total Kendaraan',
      value: stats?.vehicles.total || 0,
      subValue: stats?.vehicles.thisMonth || 0,
      subLabel: 'bulan ini',
      subColor: 'text-emerald-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4M7 13v2a2 2 0 002 2h6a2 2 0 002-2v-2" />
        </svg>
      ),
      emoji: '🚗',
      gradient: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      href: '/dashboard/vehicles',
    },
    {
      title: 'Analytics',
      value: stats?.leads.active || 0,
      subValue: stats?.leads.today || 0,
      subLabel: 'chat hari ini',
      subColor: 'text-emerald-600',
      emoji: '💬',
      gradient: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      href: '/dashboard/whatsapp-ai/analytics',
    },
    {
      title: 'Tim Showroom',
      value: stats?.team.total || 0,
      subValue: stats?.team.active || 0,
      subLabel: 'aktif',
      subColor: 'text-emerald-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      emoji: '👥',
      gradient: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-50',
      href: '/dashboard/users',
    },
    {
      title: 'Penjualan',
      value: stats?.sales.thisMonth || 0,
      subValue: stats?.sales.changePercent || 0,
      subLabel: 'vs bulan lalu',
      subColor: (stats?.sales.changePercent || 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      isPercent: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      emoji: '💰',
      gradient: 'from-amber-500 to-amber-600',
      bgLight: 'bg-amber-50',
      href: '/dashboard/vehicles?status=SOLD',
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

      {/* Stats Grid - Cards with Colored Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        {statsConfig.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className={`group bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all p-2 md:p-3 ${
              index === 0 ? 'hover:border-blue-400 hover:bg-blue-50/50' :
              index === 1 ? 'hover:border-emerald-400 hover:bg-emerald-50/50' :
              index === 2 ? 'hover:border-violet-400 hover:bg-violet-50/50' :
              'hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            {/* Mobile: Vertical layout, Desktop: Horizontal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              {/* Icon - Top on mobile, Right on desktop */}
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all shadow-sm mx-auto md:mx-0 md:order-2 mb-2 md:mb-0 ${
                index === 0 ? 'bg-blue-100 group-hover:bg-blue-500 border-2 border-blue-200 group-hover:border-blue-500' :
                index === 1 ? 'bg-emerald-100 group-hover:bg-emerald-500 border-2 border-emerald-200 group-hover:border-emerald-500' :
                index === 2 ? 'bg-violet-100 group-hover:bg-violet-500 border-2 border-violet-200 group-hover:border-violet-500' :
                'bg-amber-100 group-hover:bg-amber-500 border-2 border-amber-200 group-hover:border-amber-500'
              }`}>
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
                      {stat.isPercent ? `${stat.subValue >= 0 ? '+' : ''}${stat.subValue}%` : `+${stat.subValue}`}
                    </span>
                    {' '}{stat.subLabel}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content - Analytics & Subscription Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-shrink-0">
        {/* Left: Analytics */}
        <div className="md:col-span-2 order-2 md:order-1">
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base md:text-lg font-bold text-gray-800">Analytics WhatsApp AI</h3>
              <Link href="/dashboard/whatsapp-ai/analytics" className="text-xs md:text-sm text-blue-600 hover:text-blue-800 font-medium">
                Lihat Detail →
              </Link>
            </div>
            <div className="p-3 md:p-4">
              {loadingAnalytics ? (
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-50 rounded-lg animate-pulse h-40 md:h-48"></div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {/* AI Performance Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-sm flex flex-col"
                  >
                    <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">AI Performance</h4>
                    <div className="flex-1 flex items-center justify-center py-2">
                      <div className="relative">
                        <svg className="w-20 h-20 md:w-28 md:h-28" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                          <circle
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="3.5"
                            strokeDasharray={`${(analytics?.performance.aiAccuracy || 0) * 0.88} 88`}
                            strokeDashoffset="22"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-base md:text-xl font-bold text-gray-700">{analytics?.performance.aiAccuracy || 0}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Legend - 2x2 grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Accuracy</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Satisfact.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Resolution</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Escalation</span>
                      </div>
                    </div>
                  </Link>

                  {/* Intent Breakdown Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-sm flex flex-col"
                  >
                    <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">Intent Breakdown</h4>
                    <div className="flex-1 flex items-center justify-center py-2">
                      <div className="relative">
                        <svg className="w-20 h-20 md:w-28 md:h-28" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                          {analytics?.intentBreakdown && analytics.intentBreakdown.length > 0 ? (
                            (() => {
                              let offset = 0;
                              return analytics.intentBreakdown.slice(0, 5).map((item, idx) => {
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
                          <span className="text-base md:text-xl font-bold text-gray-700">{analytics?.intentBreakdown?.reduce((sum, i) => sum + i.percentage, 0) || 0}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Legend - 3 cols for 5 items */}
                    <div className="grid grid-cols-3 gap-x-1 gap-y-1 mt-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Price</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Greeting</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">General</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Vehicle</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span className="text-[9px] md:text-[10px] text-gray-600 truncate">Closing</span>
                      </div>
                    </div>
                  </Link>

                  {/* Staff Activity Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-sm flex flex-col"
                  >
                    <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">Staff Activity</h4>
                    <div className="flex-1 flex items-center justify-center py-2">
                      {/* Bar Chart */}
                      <div className="flex items-end gap-2 md:gap-3 h-20 md:h-28">
                        {analytics?.staffActivity && analytics.staffActivity.length > 0 ? (
                          analytics.staffActivity.slice(0, 5).map((staff, idx) => {
                            const maxCommands = Math.max(...analytics.staffActivity.map(s => s.commandCount), 1);
                            const heightPercent = (staff.commandCount / maxCommands) * 100;
                            return (
                              <div
                                key={idx}
                                className="w-5 md:w-7 bg-blue-500 rounded-t transition-all"
                                style={{ height: `${Math.max(heightPercent, 10)}%` }}
                                title={`${staff.staffPhone}: ${staff.commandCount} commands`}
                              ></div>
                            );
                          })
                        ) : (
                          // Default empty bars
                          [1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="w-5 md:w-7 bg-gray-300 rounded-t"
                              style={{ height: `${15 + i * 12}%` }}
                            ></div>
                          ))
                        )}
                      </div>
                    </div>
                    {/* Staff count or empty message */}
                    <div className="mt-2 text-center">
                      {analytics?.staffActivity && analytics.staffActivity.length > 0 ? (
                        <span className="text-[10px] md:text-xs text-gray-600">
                          {analytics.staffActivity.length} staff aktif
                        </span>
                      ) : (
                        <span className="text-[10px] md:text-xs text-gray-400">
                          Belum ada aktivitas
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Subscription - Show first on mobile */}
        <div className="md:col-span-1 order-1 md:order-2">
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>

      {/* Quick Actions - Horizontal scroll on mobile, Grid on desktop */}
      <div className="bg-white rounded-lg border border-gray-200 flex-shrink-0 mt-2">
        <div className="px-3 md:px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm md:text-base font-bold text-gray-800">Aksi Cepat</h3>
        </div>
        <div className="p-2 md:p-3">
          {/* Mobile: Horizontal scroll, Desktop: Grid */}
          <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <Link
              href="/dashboard/vehicles"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-all group border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition-colors border border-blue-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">🚗</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-blue-800 group-hover:text-blue-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Kendaraan</span>
            </Link>
            <Link
              href="/dashboard/whatsapp-ai/conversations"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-all group border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center transition-colors border border-emerald-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">💬</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-emerald-800 group-hover:text-emerald-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">WhatsApp</span>
            </Link>
            <Link
              href="/dashboard/users"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-all group border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-violet-100 group-hover:bg-violet-200 rounded-xl flex items-center justify-center transition-colors border border-violet-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">👥</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-violet-800 group-hover:text-violet-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Tim</span>
            </Link>
            <Link
              href="/dashboard/blog"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-all group border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-orange-100 group-hover:bg-orange-200 rounded-xl flex items-center justify-center transition-colors border border-orange-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">📝</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-orange-800 group-hover:text-orange-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Blog</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
