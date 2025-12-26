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
          {(() => {
            // Define metrics once for both donut and legend
            const metrics = [
              { value: analytics.performance.aiAccuracy || 0, color: '#22c55e', bgColor: 'bg-green-500', name: 'AI Accuracy', label: 'Akurasi respons AI' },
              { value: analytics.performance.resolutionRate || 0, color: '#eab308', bgColor: 'bg-yellow-500', name: 'Resolution', label: 'Tingkat penyelesaian' },
              { value: analytics.performance.customerSatisfaction || 0, color: '#f97316', bgColor: 'bg-orange-500', name: 'Satisfaction', label: 'Kepuasan pelanggan' },
              { value: analytics.overview.escalationRate || 0, color: '#ef4444', bgColor: 'bg-red-500', name: 'Escalation', label: 'Eskalasi ke manusia' },
            ];

            // Calculate total and average score
            // For avg score: AI Accuracy, Resolution, Satisfaction are positive (higher=better)
            // Escalation is negative (lower=better), so we use (100 - escalation) for avg calculation
            const avgScore = Math.round(
              (metrics[0].value + metrics[1].value + metrics[2].value + (100 - metrics[3].value)) / 4
            );

            // For donut: use actual values, filter out zeros for cleaner display
            const activeMetrics = metrics.filter(m => m.value > 0);
            const total = activeMetrics.reduce((sum, m) => sum + m.value, 0) || 1;
            const radius = 15.9155;
            const circumference = 2 * Math.PI * radius;

            return (
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* Donut Chart */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    {/* Background circle when no data */}
                    {activeMetrics.length === 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r={radius}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3.5"
                      />
                    )}
                    {/* Metric segments */}
                    {(() => {
                      let offset = 0;
                      return activeMetrics.map((metric) => {
                        const percentage = (metric.value / total) * 100;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -offset;
                        offset += (percentage / 100) * circumference;

                        return (
                          <circle
                            key={metric.name}
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke={metric.color}
                            strokeWidth="3.5"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(-90 18 18)"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-lg md:text-xl font-bold ${avgScore >= 70 ? 'text-green-600' : avgScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {avgScore}%
                    </span>
                    <span className="text-[8px] md:text-[10px] text-gray-500">Avg Score</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {metrics.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.bgColor}`}></div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs md:text-sm text-gray-700">{item.name}</span>
                        <p className="text-[9px] md:text-[10px] text-gray-400 truncate">{item.label}</p>
                      </div>
                      <span className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Intent Breakdown</h2>
          {(() => {
            // Default intent categories for display
            const defaultIntents = [
              { intent: 'customer_greeting', label: 'Greeting', color: '#16a34a', bgColor: 'bg-green-600' },
              { intent: 'customer_vehicle_inquiry', label: 'Vehicle Inquiry', color: '#2563eb', bgColor: 'bg-blue-600' },
              { intent: 'customer_price_inquiry', label: 'Price Inquiry', color: '#9333ea', bgColor: 'bg-purple-600' },
              { intent: 'customer_general_question', label: 'General Question', color: '#ea580c', bgColor: 'bg-orange-600' },
              { intent: 'customer_closing', label: 'Closing', color: '#dc2626', bgColor: 'bg-red-600' },
            ];

            // Merge actual data with defaults
            const intentData = defaultIntents.map(def => {
              const actual = analytics.intentBreakdown.find(i => i.intent === def.intent);
              return {
                ...def,
                count: actual?.count || 0,
                percentage: actual?.percentage || 0,
              };
            });

            // Add any intents from data that aren't in defaults
            analytics.intentBreakdown.forEach(item => {
              if (!defaultIntents.find(d => d.intent === item.intent)) {
                const colorIndex = intentData.length % 5;
                const colors = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#dc2626'];
                const bgColors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-red-600'];
                intentData.push({
                  intent: item.intent,
                  label: item.intent.replace('customer_', '').replace(/_/g, ' '),
                  color: colors[colorIndex],
                  bgColor: bgColors[colorIndex],
                  count: item.count,
                  percentage: item.percentage,
                });
              }
            });

            const totalCount = intentData.reduce((sum, item) => sum + item.count, 0);
            const activeIntents = intentData.filter(i => i.count > 0);
            const radius = 15.9155;
            const circumference = 2 * Math.PI * radius;

            return (
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* Donut Chart */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    {/* Background circle when no data */}
                    {activeIntents.length === 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r={radius}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3.5"
                      />
                    )}
                    {/* Intent segments */}
                    {(() => {
                      let offset = 0;
                      return activeIntents.map((item) => {
                        const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -offset;
                        offset += (percentage / 100) * circumference;

                        return (
                          <circle
                            key={item.intent}
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="3.5"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(-90 18 18)"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-lg md:text-xl font-bold ${totalCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {totalCount}
                    </span>
                    <span className="text-[8px] md:text-[10px] text-gray-500">Total</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {intentData.map((item) => (
                    <div key={item.intent} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.bgColor}`}></div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs md:text-sm text-gray-700 capitalize">{item.label}</span>
                      </div>
                      <span className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Staff Activity - Vertical Bar Chart */}
      {analytics.staffActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 md:mb-8">
          <div className="p-3 md:p-6 border-b border-gray-200">
            <h2 className="text-sm md:text-lg font-semibold text-gray-900">Staff Activity</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">WhatsApp command usage & performance</p>
          </div>

          {(() => {
            const staffData = analytics.staffActivity;
            const maxCommands = Math.max(...staffData.map(s => s.commandCount));
            const totalCommands = staffData.reduce((sum, s) => sum + s.commandCount, 0);
            const avgSuccessRate = Math.round(staffData.reduce((sum, s) => sum + s.successRate, 0) / staffData.length);

            // Sort by command count descending
            const sortedStaff = [...staffData].sort((a, b) => b.commandCount - a.commandCount);

            // Performance classification
            const excellent = staffData.filter(s => s.successRate >= 90).length;
            const good = staffData.filter(s => s.successRate >= 70 && s.successRate < 90).length;
            const needsImprovement = staffData.filter(s => s.successRate < 70).length;

            return (
              <div className="p-3 md:p-6">
                {/* Summary Stats - Compact */}
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">
                  {/* Total Commands - Blue */}
                  <div className="bg-blue-50 rounded-lg p-2 md:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded bg-blue-500"></div>
                      <span className="text-[8px] md:text-[10px] text-blue-700 font-medium">Total Commands</span>
                    </div>
                    <div className="text-sm md:text-base font-bold text-blue-600">{totalCommands}</div>
                    <div className="h-1 md:h-1.5 bg-blue-200 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>

                  {/* Avg Success Rate - Green */}
                  <div className="bg-green-50 rounded-lg p-2 md:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded bg-green-500"></div>
                      <span className="text-[8px] md:text-[10px] text-green-700 font-medium">Avg Success</span>
                    </div>
                    <div className="text-sm md:text-base font-bold text-green-600">{avgSuccessRate}%</div>
                    <div className="h-1 md:h-1.5 bg-green-200 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${avgSuccessRate}%` }}></div>
                    </div>
                  </div>

                  {/* Active Staff - Purple */}
                  <div className="bg-purple-50 rounded-lg p-2 md:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded bg-purple-500"></div>
                      <span className="text-[8px] md:text-[10px] text-purple-700 font-medium">Active Staff</span>
                    </div>
                    <div className="text-sm md:text-base font-bold text-purple-600">{staffData.length}</div>
                    <div className="h-1 md:h-1.5 bg-purple-200 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                </div>

                {/* Section Title */}
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-3">Summary Statistik Staff</h3>

                {/* Main Chart Area */}
                <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch">
                  {/* Staff List with WhatsApp Icon - Vertically centered */}
                  <div className="lg:min-w-[160px] order-2 lg:order-1 flex flex-col justify-center">
                    <div className="text-[9px] md:text-xs font-medium text-gray-500 mb-2">No. WhatsApp Staff</div>
                    <div className="flex flex-row lg:flex-col gap-2 lg:gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                      {sortedStaff.map((staff, idx) => {
                        return (
                          <div key={idx} className="flex items-center gap-1.5 flex-shrink-0">
                            {/* WhatsApp Icon */}
                            <svg className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#25D366">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="text-[9px] md:text-xs font-medium text-gray-700 whitespace-nowrap">
                              {staff.staffPhone}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grouped Vertical Bar Chart */}
                  <div className="flex-1 order-1 lg:order-2">
                    <div className="flex items-end justify-around gap-2 md:gap-4" style={{ height: '160px' }}>
                      {sortedStaff.map((staff, idx) => {
                        // Blue = Upload success rate (percentage)
                        const uploadSuccessHeight = staff.successRate;
                        // Green = Total commands executed
                        const commandHeight = maxCommands > 0 ? (staff.commandCount / maxCommands) * 100 : 0;
                        // Purple = Staff who successfully sold vehicles (using successful commands as proxy)
                        const soldVehicles = Math.round(staff.commandCount * staff.successRate / 100);
                        const soldHeight = maxCommands > 0 ? (soldVehicles / maxCommands) * 100 : 0;

                        return (
                          <div key={idx} className="flex flex-col items-center" style={{ flex: 1, maxWidth: '120px' }}>
                            {/* Grouped Bars Container */}
                            <div className="flex items-end gap-1 w-full justify-center" style={{ height: '120px' }}>
                              {/* Blue Bar - Upload Success Rate */}
                              <div className="flex flex-col items-center" style={{ width: '24px' }}>
                                <span className="text-[8px] md:text-[10px] font-bold text-blue-600 mb-1">
                                  {staff.successRate}%
                                </span>
                                <div
                                  className="w-full bg-blue-500 rounded-t transition-all duration-500"
                                  style={{ height: `${Math.max(uploadSuccessHeight, 8)}px`, minHeight: '8px' }}
                                ></div>
                              </div>

                              {/* Green Bar - Total Commands */}
                              <div className="flex flex-col items-center" style={{ width: '24px' }}>
                                <span className="text-[8px] md:text-[10px] font-bold text-green-600 mb-1">
                                  {staff.commandCount}
                                </span>
                                <div
                                  className="w-full bg-green-500 rounded-t transition-all duration-500"
                                  style={{ height: `${Math.max(commandHeight, 8)}px`, minHeight: '8px' }}
                                ></div>
                              </div>

                              {/* Purple Bar - Sold Vehicles */}
                              <div className="flex flex-col items-center" style={{ width: '24px' }}>
                                <span className="text-[8px] md:text-[10px] font-bold text-purple-600 mb-1">
                                  {soldVehicles}
                                </span>
                                <div
                                  className="w-full bg-purple-500 rounded-t transition-all duration-500"
                                  style={{ height: `${Math.max(soldHeight, 8)}px`, minHeight: '8px' }}
                                ></div>
                              </div>
                            </div>

                            {/* Staff Label */}
                            <div className="mt-2 text-[8px] md:text-[10px] text-gray-500 text-center">
                              Staff {idx + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis label */}
                    <div className="text-center mt-2 text-[8px] md:text-[10px] text-gray-400">
                      Performance per Staff
                    </div>
                  </div>
                </div>

                {/* Legend Tables - Bottom */}
                <div className="mt-3 md:mt-4 pt-3 border-t border-gray-200">
                  <div className="flex flex-col md:flex-row gap-3 md:gap-0">
                    {/* Performance Legend - LEFT */}
                    <div className="flex-1 md:pr-4">
                      <h4 className="text-[8px] md:text-[10px] font-medium text-gray-500 mb-1.5">Keterangan Performance Staff</h4>
                      <div className="space-y-1 text-[8px] md:text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-green-500 flex-shrink-0"></div>
                          <span className="text-green-600 font-medium">Hijau</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-700">Excellent</span>
                          <span className="text-gray-400">(≥90%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-yellow-500 flex-shrink-0"></div>
                          <span className="text-yellow-600 font-medium">Kuning</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-700">Good</span>
                          <span className="text-gray-400">(70-89%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-red-500 flex-shrink-0"></div>
                          <span className="text-red-600 font-medium">Merah</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-700">Need Improve</span>
                          <span className="text-gray-400">(&lt;70%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Vertical Divider - Black line */}
                    <div className="hidden md:block w-px bg-gray-800 mx-4"></div>
                    {/* Horizontal Divider for mobile */}
                    <div className="md:hidden h-px bg-gray-800 my-2"></div>

                    {/* Bar Chart Legend - RIGHT */}
                    <div className="flex-1 md:pl-4">
                      <h4 className="text-[8px] md:text-[10px] font-medium text-gray-500 mb-1.5">Keterangan Diagram Batang</h4>
                      <div className="space-y-1 text-[8px] md:text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-blue-500 flex-shrink-0"></div>
                          <span className="text-blue-600 font-medium">Biru</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-600">Persentase upload sukses kendaraan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-green-500 flex-shrink-0"></div>
                          <span className="text-green-600 font-medium">Hijau</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-600">Jumlah total command dieksekusi</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-purple-500 flex-shrink-0"></div>
                          <span className="text-purple-600 font-medium">Ungu</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-600">Jumlah staff berhasil menjual</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
