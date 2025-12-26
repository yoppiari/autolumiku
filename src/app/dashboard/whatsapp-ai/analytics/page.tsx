/**
 * WhatsApp AI Analytics Dashboard
 * Performance metrics, conversation insights, AI accuracy
 * Optimized for fit-to-screen at 100% zoom
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;
      const parsedUser = JSON.parse(storedUser);
      const response = await fetch(`/api/v1/whatsapp-ai/analytics?tenantId=${parsedUser.tenantId}&range=${timeRange}`);
      const data = await response.json();
      if (data.success) setAnalytics(data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800 text-sm">Setup WhatsApp AI terlebih dahulu.</p>
          <Link href="/dashboard/whatsapp-ai/setup" className="mt-2 inline-block px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg">
            Setup →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-3 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-2 ml-8 md:ml-0">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 text-xs">← Back</Link>
          <div>
            <h1 className="text-sm md:text-lg font-bold text-gray-900">Analytics</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {['today', 'week', 'month'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as typeof timeRange)}
              className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${
                timeRange === range ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col gap-2">
        {/* Row 1: AI Performance & Intent Breakdown */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
          {/* AI Performance */}
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-[10px] md:text-xs font-semibold text-gray-900 mb-1">AI Performance</h2>
            {(() => {
              const metrics = [
                { value: analytics.performance.aiAccuracy || 0, color: '#22c55e', name: 'Accuracy' },
                { value: analytics.performance.resolutionRate || 0, color: '#eab308', name: 'Resolution' },
                { value: analytics.performance.customerSatisfaction || 0, color: '#f97316', name: 'Satisfaction' },
                { value: analytics.overview.escalationRate || 0, color: '#ef4444', name: 'Escalation' },
              ];
              const avgScore = Math.round((metrics[0].value + metrics[1].value + metrics[2].value + (100 - metrics[3].value)) / 4);
              const activeMetrics = metrics.filter(m => m.value > 0);
              const total = activeMetrics.reduce((sum, m) => sum + m.value, 0) || 1;
              const radius = 15.9155;
              const circumference = 2 * Math.PI * radius;

              return (
                <div className="flex items-center gap-2">
                  <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      {activeMetrics.length === 0 && <circle cx="18" cy="18" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />}
                      {(() => {
                        let offset = 0;
                        return activeMetrics.map((m) => {
                          const pct = (m.value / total) * 100;
                          const dash = `${(pct / 100) * circumference} ${circumference}`;
                          const el = <circle key={m.name} cx="18" cy="18" r={radius} fill="none" stroke={m.color} strokeWidth="3" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />;
                          offset += (pct / 100) * circumference;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-xs md:text-sm font-bold ${avgScore >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{avgScore}%</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    {metrics.map((m) => (
                      <div key={m.name} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }}></div>
                        <span className="text-[8px] md:text-[9px] text-gray-600 flex-1">{m.name}</span>
                        <span className="text-[8px] md:text-[9px] font-semibold">{m.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Intent Breakdown */}
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-[10px] md:text-xs font-semibold text-gray-900 mb-1">Intent Breakdown</h2>
            {(() => {
              const defaultIntents = [
                { intent: 'customer_greeting', label: 'Greeting', color: '#16a34a' },
                { intent: 'customer_vehicle_inquiry', label: 'Vehicle', color: '#2563eb' },
                { intent: 'customer_price_inquiry', label: 'Price', color: '#9333ea' },
                { intent: 'customer_general_question', label: 'General', color: '#ea580c' },
                { intent: 'customer_closing', label: 'Closing', color: '#dc2626' },
              ];
              const intentData = defaultIntents.map(def => {
                const actual = analytics.intentBreakdown.find(i => i.intent === def.intent);
                return { ...def, count: actual?.count || 0, percentage: actual?.percentage || 0 };
              });
              const totalCount = intentData.reduce((sum, i) => sum + i.count, 0);
              const activeIntents = intentData.filter(i => i.count > 0);
              const radius = 15.9155;
              const circumference = 2 * Math.PI * radius;

              return (
                <div className="flex items-center gap-2">
                  <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      {activeIntents.length === 0 && <circle cx="18" cy="18" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />}
                      {(() => {
                        let offset = 0;
                        return activeIntents.map((i) => {
                          const pct = totalCount > 0 ? (i.count / totalCount) * 100 : 0;
                          const dash = `${(pct / 100) * circumference} ${circumference}`;
                          const el = <circle key={i.intent} cx="18" cy="18" r={radius} fill="none" stroke={i.color} strokeWidth="3" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />;
                          offset += (pct / 100) * circumference;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-xs md:text-sm font-bold ${totalCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{totalCount}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    {intentData.map((i) => (
                      <div key={i.intent} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: i.color }}></div>
                        <span className="text-[8px] md:text-[9px] text-gray-600 flex-1">{i.label}</span>
                        <span className="text-[8px] md:text-[9px] font-semibold">{i.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Row 2: Staff Activity */}
        {analytics.staffActivity.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-shrink-0">
            <div className="px-2 py-1 border-b border-gray-100">
              <h2 className="text-[10px] md:text-xs font-semibold text-gray-900">Staff Activity</h2>
            </div>
            {(() => {
              const staffData = analytics.staffActivity;
              const maxCommands = Math.max(...staffData.map(s => s.commandCount));
              const totalCommands = staffData.reduce((sum, s) => sum + s.commandCount, 0);
              const avgSuccessRate = Math.round(staffData.reduce((sum, s) => sum + s.successRate, 0) / staffData.length);
              const sortedStaff = [...staffData].sort((a, b) => b.commandCount - a.commandCount);

              return (
                <div className="p-2">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    <div className="bg-blue-50 rounded p-1">
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded bg-blue-500"></div>
                        <span className="text-[6px] md:text-[8px] text-blue-700">Commands</span>
                      </div>
                      <div className="text-[10px] md:text-xs font-bold text-blue-600">{totalCommands}</div>
                    </div>
                    <div className="bg-green-50 rounded p-1">
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded bg-green-500"></div>
                        <span className="text-[6px] md:text-[8px] text-green-700">Success</span>
                      </div>
                      <div className="text-[10px] md:text-xs font-bold text-green-600">{avgSuccessRate}%</div>
                    </div>
                    <div className="bg-purple-50 rounded p-1">
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded bg-purple-500"></div>
                        <span className="text-[6px] md:text-[8px] text-purple-700">Staff</span>
                      </div>
                      <div className="text-[10px] md:text-xs font-bold text-purple-600">{staffData.length}</div>
                    </div>
                  </div>

                  {/* Chart Area - Horizontal layout */}
                  <div className="flex gap-2">
                    {/* Staff List */}
                    <div className="w-24 md:w-28 flex-shrink-0">
                      <div className="text-[7px] md:text-[9px] text-gray-500 mb-1">WhatsApp Staff</div>
                      <div className="space-y-0.5">
                        {sortedStaff.map((staff, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="#25D366">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="text-[7px] md:text-[9px] text-gray-700 truncate">{staff.staffPhone}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="flex-1">
                      <div className="text-[7px] md:text-[9px] text-gray-600 text-center mb-1">Summary Statistik Staff</div>
                      <div className="flex items-end justify-around gap-1" style={{ height: '100px' }}>
                        {sortedStaff.map((staff, idx) => {
                          const successH = staff.successRate;
                          const cmdH = maxCommands > 0 ? (staff.commandCount / maxCommands) * 100 : 0;
                          const soldV = Math.round(staff.commandCount * staff.successRate / 100);
                          const soldH = maxCommands > 0 ? (soldV / maxCommands) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-col items-center flex-1">
                              <div className="flex items-end gap-px w-full justify-center" style={{ height: '80px' }}>
                                <div className="flex flex-col items-center" style={{ width: '16px' }}>
                                  <span className="text-[6px] font-bold text-blue-600">{staff.successRate}%</span>
                                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(successH * 0.7, 4)}px` }}></div>
                                </div>
                                <div className="flex flex-col items-center" style={{ width: '16px' }}>
                                  <span className="text-[6px] font-bold text-green-600">{staff.commandCount}</span>
                                  <div className="w-full bg-green-500 rounded-t" style={{ height: `${Math.max(cmdH * 0.7, 4)}px` }}></div>
                                </div>
                                <div className="flex flex-col items-center" style={{ width: '16px' }}>
                                  <span className="text-[6px] font-bold text-purple-600">{soldV}</span>
                                  <div className="w-full bg-purple-500 rounded-t" style={{ height: `${Math.max(soldH * 0.7, 4)}px` }}></div>
                                </div>
                              </div>
                              <span className="text-[6px] text-gray-500 mt-0.5">Staff {idx + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Legends - Always visible */}
                  <div className="flex gap-3 pt-2 border-t border-gray-100 mt-2">
                    <div>
                      <span className="text-[7px] md:text-[8px] text-gray-500">Performance:</span>
                      <div className="flex gap-2 text-[7px] md:text-[8px]">
                        <span className="text-green-600">● ≥90%</span>
                        <span className="text-yellow-600">● 70-89%</span>
                        <span className="text-red-600">● &lt;70%</span>
                      </div>
                    </div>
                    <div className="w-px bg-gray-300"></div>
                    <div>
                      <span className="text-[7px] md:text-[8px] text-gray-500">Diagram:</span>
                      <div className="flex gap-2 text-[7px] md:text-[8px]">
                        <span className="text-blue-600">● Success%</span>
                        <span className="text-green-600">● Commands</span>
                        <span className="text-purple-600">● Sold</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
