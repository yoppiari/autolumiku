/**
 * WhatsApp AI Analytics Dashboard
 * Performance metrics, conversation insights, AI accuracy
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
      if (!storedUser) {
        console.error('No user found');
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      const tenantId = parsedUser.tenantId;

      const response = await fetch(
        `/api/v1/whatsapp-ai/analytics?tenantId=${tenantId}&range=${timeRange}`
      );
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">Tidak ada data analytics. Setup WhatsApp AI terlebih dahulu.</p>
          <Link
            href="/dashboard/whatsapp-ai/setup"
            className="mt-4 inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Setup WhatsApp AI →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-8 ml-8 md:ml-0">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-2 md:mb-4 inline-block text-sm md:text-base">
          ← Back
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Analytics & Insights</h1>
            <p className="text-gray-600 text-xs md:text-base mt-1">AI performance & metrics</p>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                timeRange === 'today'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                timeRange === 'week'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                timeRange === 'month'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-4 md:mb-8">
        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-[10px] md:text-sm font-medium text-gray-500">Total Conversations</h3>
            <span className="text-base md:text-2xl">💬</span>
          </div>
          <div className="text-xl md:text-3xl font-bold text-gray-900">{analytics.overview.totalConversations}</div>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{analytics.overview.activeConversations} active</p>
        </div>

        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-[10px] md:text-sm font-medium text-gray-500">Messages</h3>
            <span className="text-base md:text-2xl">📨</span>
          </div>
          <div className="text-xl md:text-3xl font-bold text-gray-900">{analytics.overview.totalMessages}</div>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">All conversations</p>
        </div>

        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-[10px] md:text-sm font-medium text-gray-500">AI Response</h3>
            <span className="text-base md:text-2xl">🤖</span>
          </div>
          <div className="text-xl md:text-3xl font-bold text-green-600">{analytics.overview.aiResponseRate}%</div>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Automated</p>
        </div>

        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-[10px] md:text-sm font-medium text-gray-500">Avg Response</h3>
            <span className="text-base md:text-2xl">⚡</span>
          </div>
          <div className="text-xl md:text-3xl font-bold text-blue-600">
            {formatResponseTime(analytics.overview.avgResponseTime)}
          </div>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Fast!</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mb-4 md:mb-8">
        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">AI Performance</h2>
          <div className="flex items-center justify-center gap-4">
            {/* Left Descriptions */}
            <div className="flex flex-col gap-3 text-right min-w-[80px] md:min-w-[100px]">
              <div>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] md:text-xs text-gray-600">AI Accuracy</span>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">Akurasi respons AI</p>
              </div>
              <div>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] md:text-xs text-gray-600">Resolution</span>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">Tingkat penyelesaian</p>
              </div>
            </div>

            {/* Donut Chart */}
            <div className="relative w-28 h-28 md:w-36 md:h-36 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {(() => {
                  const metrics = [
                    { value: analytics.performance.aiAccuracy || 0, color: '#22c55e', name: 'AI Accuracy' },
                    { value: analytics.performance.resolutionRate || 0, color: '#eab308', name: 'Resolution' },
                    { value: analytics.performance.customerSatisfaction || 0, color: '#f97316', name: 'Satisfaction' },
                    { value: analytics.overview.escalationRate || 0, color: '#ef4444', name: 'Escalation' },
                  ];
                  const total = metrics.reduce((sum, m) => sum + m.value, 0);
                  const cx = 50, cy = 50, radius = 35, innerRadius = 20;

                  // If no data, show empty ring
                  if (total === 0) {
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={(radius + innerRadius) / 2}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth={radius - innerRadius}
                      />
                    );
                  }

                  let cumulativePercent = 0;
                  return metrics.map((metric, index) => {
                    if (metric.value === 0) return null;

                    const percent = (metric.value / total) * 100;
                    const startPercent = cumulativePercent;
                    cumulativePercent += percent;

                    // Calculate arc path for donut segment
                    const startAngle = (startPercent / 100) * 360 - 90;
                    const endAngle = (cumulativePercent / 100) * 360 - 90;
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    // Outer arc points
                    const x1 = cx + radius * Math.cos(startRad);
                    const y1 = cy + radius * Math.sin(startRad);
                    const x2 = cx + radius * Math.cos(endRad);
                    const y2 = cy + radius * Math.sin(endRad);

                    // Inner arc points
                    const x3 = cx + innerRadius * Math.cos(endRad);
                    const y3 = cy + innerRadius * Math.sin(endRad);
                    const x4 = cx + innerRadius * Math.cos(startRad);
                    const y4 = cy + innerRadius * Math.sin(startRad);

                    const largeArc = percent > 50 ? 1 : 0;

                    // Label position
                    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
                    const labelRadius = (radius + innerRadius) / 2;
                    const labelX = cx + labelRadius * Math.cos(midAngle);
                    const labelY = cy + labelRadius * Math.sin(midAngle);

                    return (
                      <g key={index}>
                        <path
                          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`}
                          fill={metric.color}
                          stroke="white"
                          strokeWidth="1"
                        />
                        {percent >= 10 && (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize="7"
                            fontWeight="bold"
                          >
                            {metric.value}%
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
                {/* Center text */}
                <text x="50" y="47" textAnchor="middle" fill="#374151" fontSize="11" fontWeight="bold">
                  {Math.round((analytics.performance.aiAccuracy + analytics.performance.resolutionRate + analytics.performance.customerSatisfaction + (100 - analytics.overview.escalationRate)) / 4)}%
                </text>
                <text x="50" y="58" textAnchor="middle" fill="#9ca3af" fontSize="6">
                  Avg Score
                </text>
              </svg>
            </div>

            {/* Right Descriptions */}
            <div className="flex flex-col gap-3 text-left min-w-[80px] md:min-w-[100px]">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-[10px] md:text-xs text-gray-600">Satisfaction</span>
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">Kepuasan pelanggan</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-[10px] md:text-xs text-gray-600">Escalation</span>
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">Diteruskan ke manusia</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Intent Breakdown</h2>
          {analytics.intentBreakdown.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-3xl mb-2 block">📊</span>
              <p className="text-sm">Belum ada data intent</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Donut Chart */}
              <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  {(() => {
                    const colors = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#dc2626'];
                    const radius = 15.9155;
                    const circumference = 2 * Math.PI * radius;
                    let offset = 0;

                    return analytics.intentBreakdown.map((item, index) => {
                      const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -offset;
                      offset += (item.percentage / 100) * circumference;

                      return (
                        <circle
                          key={item.intent}
                          cx="18"
                          cy="18"
                          r={radius}
                          fill="none"
                          stroke={colors[index % colors.length]}
                          strokeWidth="3.5"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform="rotate(-90 18 18)"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs md:text-sm font-bold text-gray-700">
                    {analytics.intentBreakdown.reduce((sum, item) => sum + item.count, 0)}
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2">
                {analytics.intentBreakdown.map((item, index) => {
                  const colors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-red-600'];
                  return (
                    <div key={item.intent} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors[index % colors.length]}`}></div>
                      <span className="text-xs md:text-sm text-gray-600 capitalize truncate flex-1">
                        {item.intent.replace('customer_', '').replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap">
                        {item.percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Staff Activity */}
      {analytics.staffActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 md:mb-8">
          <div className="p-3 md:p-6 border-b border-gray-200">
            <h2 className="text-sm md:text-lg font-semibold text-gray-900">Staff Activity</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">WhatsApp command usage</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cmd
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="hidden md:inline">Last Active</span>
                    <span className="md:hidden">Active</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.staffActivity.map((staff, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-[10px] md:text-sm font-medium text-gray-900">
                      <span className="hidden md:inline">{staff.staffPhone}</span>
                      <span className="md:hidden">{staff.staffPhone.slice(-6)}</span>
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-[10px] md:text-sm text-gray-900">
                      {staff.commandCount}
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded-full ${
                          staff.successRate >= 90
                            ? 'bg-green-100 text-green-800'
                            : staff.successRate >= 70
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {staff.successRate}%
                      </span>
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-[10px] md:text-sm text-gray-500">
                      <span className="hidden md:inline">{new Date(staff.lastActive).toLocaleString('id-ID')}</span>
                      <span className="md:hidden">{new Date(staff.lastActive).toLocaleDateString('id-ID')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-3 md:p-6 border border-blue-200">
        <h2 className="text-sm md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">💡 Key Insights</h2>
        <ul className="space-y-2 text-xs md:text-sm text-gray-700">
          <li className="flex items-start">
            <span className="text-green-600 mr-1 md:mr-2 flex-shrink-0">✓</span>
            <span>
              <strong>AI handling {analytics.overview.aiResponseRate}%</strong> <span className="hidden md:inline">of inquiries</span> - Excellent automation
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-1 md:mr-2 flex-shrink-0">✓</span>
            <span>
              <strong>Avg response: {formatResponseTime(analytics.overview.avgResponseTime)}</strong> - Lightning fast
            </span>
          </li>
          <li className="flex items-start">
            <span className={`${analytics.overview.escalationRate > 20 ? 'text-orange-600' : 'text-green-600'} mr-1 md:mr-2 flex-shrink-0`}>
              {analytics.overview.escalationRate > 20 ? '!' : '✓'}
            </span>
            <span>
              <strong>{analytics.overview.escalationRate}% escalation</strong> - {analytics.overview.escalationRate > 20 ? 'Improve AI training' : 'Good performance'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
