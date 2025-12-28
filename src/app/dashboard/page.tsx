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
                  {/* AI Performance Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 md:mb-4">AI Performance</h4>
                    <div className="flex items-center justify-center py-3 md:py-4">
                      <div className="relative">
                        <svg className="w-28 h-28 md:w-32 md:h-32" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                          {analytics?.performance.aiAccuracy && analytics.performance.aiAccuracy > 0 && (
                            <circle
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="3.5"
                              strokeDasharray={`${(analytics.performance.aiAccuracy / 100) * 88} 88`}
                              strokeLinecap="round"
                              transform="rotate(-90 18 18)"
                            />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl md:text-2xl font-bold text-gray-700">{analytics?.performance.aiAccuracy || 0}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Legend - 2 column grid matching analytics page */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 mt-3 md:mt-4">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Accuracy {analytics?.performance?.aiAccuracy || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-purple-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Satisfaction {analytics?.performance?.customerSatisfaction || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Resolution {analytics?.performance?.resolutionRate || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-orange-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Response {analytics?.overview?.aiResponseRate || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Escalation {analytics?.overview?.escalationRate || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-cyan-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Avg Time {analytics?.overview?.avgResponseTime || 0}s</span>
                      </div>
                    </div>
                  </Link>

                  {/* Intent Breakdown Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 md:mb-4">Intent Breakdown</h4>
                    <div className="flex items-center justify-center py-3 md:py-4">
                      <div className="relative">
                        <svg className="w-28 h-28 md:w-32 md:h-32" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                          {analytics?.intentBreakdown && analytics.intentBreakdown.length > 0 &&
                           analytics.intentBreakdown.some(i => i.percentage > 0) ? (
                            (() => {
                              let offset = 0;
                              return analytics.intentBreakdown.slice(0, 5).map((item, idx) => {
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
                          <span className="text-xl md:text-2xl font-bold text-gray-700">{analytics?.intentBreakdown?.reduce((sum, i) => sum + i.percentage, 0) || 0}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Legend - 2 column grid matching analytics page */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 mt-3 md:mt-4">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Greeting {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'greeting')?.percentage || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Vehicle {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'vehicle')?.percentage || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-purple-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Price {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'price')?.percentage || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">General {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'general')?.percentage || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Closing {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'closing')?.percentage || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gray-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Unknown {analytics?.intentBreakdown?.find(i => i.intent.toLowerCase() === 'unknown')?.percentage || 0}%</span>
                      </div>
                    </div>
                  </Link>

                  {/* AI Accuracy Card */}
                  <Link
                    href="/dashboard/whatsapp-ai/analytics"
                    className="bg-white rounded-lg shadow p-3 md:p-4 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300 hover:shadow-md flex flex-col min-w-[220px] md:min-w-0"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 md:mb-4">AI Accuracy</h4>
                    <div className="flex items-center justify-center py-3 md:py-4">
                      <div className="relative">
                        <svg className="w-28 h-28 md:w-32 md:h-32" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                          {/* Show accuracy segments when data exists */}
                          {analytics?.performance?.aiAccuracy && analytics.performance.aiAccuracy > 0 ? (
                            <circle
                              cx="18" cy="18" r="14"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="3.5"
                              strokeDasharray={`${(analytics.performance.aiAccuracy / 100) * 88} 88`}
                              strokeLinecap="round"
                              transform="rotate(-90 18 18)"
                            />
                          ) : null}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl md:text-2xl font-bold text-gray-700">
                            {analytics?.performance?.aiAccuracy || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Legend - 2 column grid matching analytics page */}
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 mt-3 md:mt-4">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Correct {analytics?.performance?.aiAccuracy || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Partial 0%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Wrong {100 - (analytics?.performance?.aiAccuracy || 0)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-purple-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Escalated {analytics?.overview?.escalationRate || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">Timeout 0%</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-cyan-500 flex-shrink-0"></span>
                        <span className="text-[10px] md:text-xs text-gray-600">No Response 0%</span>
                      </div>
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

      {/* Quick Actions - Horizontal scroll on mobile, Grid on desktop (all shown, tooltip for unauthorized) */}
      <div className="bg-white rounded-lg border border-gray-200 flex-shrink-0 mt-2">
        <div className="px-3 md:px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm md:text-base font-bold text-gray-800">Aksi Cepat</h3>
        </div>
        <div className="p-2 md:p-3">
          {/* Mobile: Horizontal scroll, Desktop: Grid */}
          {/* Invoice feature HIDDEN for all roles */}
          <div className="flex md:grid md:grid-cols-3 gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <AuthorizedLink
              href="/dashboard/vehicles"
              isAuthorized={canSeeKendaraan}
              className={`flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-blue-50 ${canSeeKendaraan ? 'hover:bg-blue-100 hover:border-blue-400 hover:shadow-lg' : ''} transition-all group border-2 border-blue-200 min-w-[70px] md:min-w-0`}
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition-colors border border-blue-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">🚗</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-blue-800 group-hover:text-blue-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Kendaraan</span>
            </AuthorizedLink>
            <AuthorizedLink
              href="/dashboard/users"
              isAuthorized={canSeeTim}
              className={`flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-violet-50 ${canSeeTim ? 'hover:bg-violet-100 hover:border-violet-400 hover:shadow-lg' : ''} transition-all group border-2 border-violet-200 min-w-[70px] md:min-w-0`}
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-violet-100 group-hover:bg-violet-200 rounded-xl flex items-center justify-center transition-colors border border-violet-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">👥</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-violet-800 group-hover:text-violet-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Tim</span>
            </AuthorizedLink>
            <AuthorizedLink
              href="/dashboard/blog"
              isAuthorized={canSeeBlog}
              className={`flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-rose-50 ${canSeeBlog ? 'hover:bg-rose-100 hover:border-rose-400 hover:shadow-lg' : ''} transition-all group border-2 border-rose-200 min-w-[70px] md:min-w-0`}
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-rose-100 group-hover:bg-rose-200 rounded-xl flex items-center justify-center transition-colors border border-rose-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">📝</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-rose-800 group-hover:text-rose-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Blog</span>
            </AuthorizedLink>
          </div>
        </div>
      </div>
    </div>
  );
}
