/**
 * WhatsApp AI Dashboard - Overview Page
 * Compact layout fit to screen at 100% zoom
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface WhatsAppStatus {
  isConnected: boolean;
  phoneNumber?: string;
  clientId?: string;
  lastConnectedAt?: string;
  totalConversations: number;
  activeConversations: number;
  todayMessages: number;
  aiResponseRate: number;
}

interface ConversationStats {
  total: number;
  active: number;
  escalated: number;
  customerChats: number;
  staffCommands: number;
  avgResponseTime: number;
  aiAccuracy: number;
}

interface AIConfig {
  aiName: string;
  welcomeMessage: string;
  autoReply: boolean;
  customerChatEnabled: boolean;
  staffCommandsEnabled: boolean;
}

interface AIHealthState {
  enabled: boolean;
  status: 'active' | 'degraded' | 'error' | 'disabled';
  errorCount: number;
  lastError?: string;
  lastErrorAt?: string;
  canProcess: boolean;
  statusMessage?: string;
}

export default function WhatsAppAIDashboard() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    isConnected: false,
    totalConversations: 0,
    activeConversations: 0,
    todayMessages: 0,
    aiResponseRate: 0,
  });
  const [stats, setStats] = useState<ConversationStats>({
    total: 0,
    active: 0,
    escalated: 0,
    customerChats: 0,
    staffCommands: 0,
    avgResponseTime: 0,
    aiAccuracy: 0,
  });
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [aiHealth, setAiHealth] = useState<AIHealthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);

      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.error('No user found in localStorage');
          setIsLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        const currentTenantId = parsedUser.tenantId;
        setTenantId(currentTenantId);

        const [statusResponse, statsResponse, configResponse, healthResponse] = await Promise.all([
          fetch(`/api/v1/whatsapp-ai/status?tenantId=${currentTenantId}`),
          fetch(`/api/v1/whatsapp-ai/stats?tenantId=${currentTenantId}`),
          fetch(`/api/v1/whatsapp-ai/config?tenantId=${currentTenantId}`),
          fetch(`/api/v1/whatsapp-ai/ai-health?tenantId=${currentTenantId}`),
        ]);

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.success) {
            setStatus(statusData.data);
          }
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStats(statsData.data);
          }
        }

        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success) {
            setAiConfig(configData.data);
          }
        }

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData.success) {
            setAiHealth(healthData.data);
          }
        }
      } catch (error) {
        console.error('Error loading WhatsApp AI data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const handleToggleAI = async () => {
    if (!tenantId) return;

    const newEnabled = aiHealth ? !aiHealth.enabled : true;
    setIsTogglingAI(true);

    try {
      const response = await fetch('/api/v1/whatsapp-ai/ai-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          enabled: newEnabled,
          reason: newEnabled ? 'Diaktifkan manual dari dashboard' : 'Dinonaktifkan manual dari dashboard',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAiHealth(prev => prev ? { ...prev, ...data.data, canProcess: newEnabled } : data.data);
        }
      } else {
        console.error('Failed to toggle AI');
      }
    } catch (error) {
      console.error('Error toggling AI:', error);
    } finally {
      setIsTogglingAI(false);
    }
  };

  const getAIStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'disabled': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getAIStatusText = (status?: string) => {
    switch (status) {
      case 'active': return 'AI Aktif';
      case 'degraded': return 'AI Terganggu';
      case 'error': return 'AI Error';
      case 'disabled': return 'AI Nonaktif';
      default: return 'Tidak Diketahui';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header - Extra left padding on mobile to avoid hamburger menu */}
      <div className="mb-3 flex-shrink-0 pl-10 md:pl-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">WhatsApp AI Rate</h1>
        <p className="text-gray-600 text-xs md:text-sm">Asisten virtual 24/7 untuk customer dan staff operations</p>
      </div>

      {/* Connection Status - With AI Controls inside */}
      <div className={`p-3 rounded-xl shadow-sm border-2 mb-3 flex-shrink-0 ${
        status.isConnected
          ? 'bg-green-50 border-green-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}>
        {/* Mobile: Stack vertically, Desktop: Horizontal */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Connection Info */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
              status.isConnected ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <span className="text-xl">
                {status.isConnected ? '✅' : '⚠️'}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900">
                {status.isConnected ? 'WhatsApp Connected' : 'Setup Required'}
              </h2>
              {status.isConnected ? (
                <div className="text-xs text-gray-700">
                  <span className="font-medium">Phone:</span> {status.phoneNumber}
                  {status.lastConnectedAt && (
                    <span className="block md:inline md:ml-2 text-gray-500">
                      Connected {new Date(status.lastConnectedAt).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-700">
                  Connect your WhatsApp Business account to activate AI assistant
                </p>
              )}
            </div>
          </div>

          {/* AI Controls - Below on mobile, Right side on desktop */}
          {status.isConnected ? (
            <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
              {/* AI Health Status Badge */}
              <div className={`flex items-center px-2 md:px-3 py-1.5 rounded-full text-white text-xs font-medium whitespace-nowrap ${getAIStatusColor(aiHealth?.status)}`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 md:mr-2 ${aiHealth?.status === 'active' ? 'animate-pulse bg-white' : 'bg-white/60'}`}></span>
                {getAIStatusText(aiHealth?.status)}
                {aiHealth && aiHealth.errorCount > 0 && aiHealth.status !== 'active' && (
                  <span className="ml-1">({aiHealth.errorCount})</span>
                )}
              </div>

              {/* AI Toggle Button - Links to config page */}
              <Link
                href="/dashboard/whatsapp-ai/config"
                className={`relative inline-flex items-center px-3 md:px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-sm whitespace-nowrap ${
                  aiHealth?.enabled !== false
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                }`}
              >
                <span className="text-base md:text-lg mr-1.5 md:mr-2">🤖</span>
                <span>
                  {aiHealth?.enabled !== false ? 'AI: ON' : 'AI: OFF'}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard/whatsapp-ai/setup"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md text-sm self-start md:self-auto"
            >
              Setup WhatsApp →
            </Link>
          )}
        </div>
      </div>

      {/* Main Content - Scrollable if needed */}
      <div className="flex-1 overflow-auto">
        {/* AI Health Alert - Show when not active */}
        {status.isConnected && aiHealth && aiHealth.status !== 'active' && (
          <div className={`p-4 rounded-xl shadow-sm border-2 mb-3 flex-shrink-0 ${
            aiHealth.status === 'disabled' ? 'bg-gray-50 border-gray-300' :
            aiHealth.status === 'degraded' ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  aiHealth.status === 'disabled' ? 'bg-gray-100' :
                  aiHealth.status === 'degraded' ? 'bg-yellow-100' :
                  'bg-red-100'
                }`}>
                  <span className="text-xl">
                    {aiHealth.status === 'disabled' ? '⏸️' :
                     aiHealth.status === 'degraded' ? '⚠️' : '❌'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {aiHealth.status === 'disabled' ? 'AI Dinonaktifkan' :
                     aiHealth.status === 'degraded' ? 'AI Mengalami Gangguan' :
                     'AI Dalam Kondisi Error'}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {aiHealth.statusMessage ||
                     (aiHealth.status === 'disabled' ? 'AI dinonaktifkan secara manual' :
                      `${aiHealth.errorCount} error berturut-turut terdeteksi`)}
                  </p>
                  {aiHealth.lastError && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                      Last error: {aiHealth.lastError.substring(0, 100)}...
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleAI}
                disabled={isTogglingAI}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  aiHealth.enabled
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } ${isTogglingAI ? 'opacity-50' : ''}`}
              >
                {isTogglingAI ? 'Loading...' : (aiHealth.enabled ? 'Nonaktifkan' : 'Aktifkan AI')}
              </button>
            </div>
            {aiHealth.status !== 'disabled' && (
              <p className="text-xs text-gray-600 mt-2 ml-13">
                💡 AI akan otomatis aktif kembali setelah 3 pesan berhasil diproses.
              </p>
            )}
          </div>
        )}

        {/* Navigation Cards - Compact */}
        {status.isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Link
              href="/dashboard/whatsapp-ai/conversations"
              className="group bg-white p-4 rounded-xl shadow-sm border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">💬</div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Conversations
                  </h3>
                  <p className="text-xs text-gray-600">
                    Monitor customer chats and staff commands in real-time
                  </p>
                </div>
              </div>
              <div className="mt-2 text-blue-600 text-xs font-medium">
                View all →
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai/analytics"
              className="group bg-white p-4 rounded-xl shadow-sm border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📊</div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                    Analytics
                  </h3>
                  <p className="text-xs text-gray-600">
                    AI performance metrics and conversation insights
                  </p>
                </div>
              </div>
              <div className="mt-2 text-purple-600 text-xs font-medium">
                View reports →
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai/config"
              className="group bg-white p-4 rounded-xl shadow-sm border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">⚙️</div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                    Configuration
                  </h3>
                  <p className="text-xs text-gray-600">
                    AI personality, business hours, and feature settings
                  </p>
                </div>
              </div>
              <div className="mt-2 text-orange-600 text-xs font-medium">
                Configure →
              </div>
            </Link>
          </div>
        )}

        {/* Single Executive Summary Card - Compact, Owner-Focused (No Duplicates) */}
        {status.isConnected && (
          <div className="bg-gradient-to-br from-green-50 via-white to-blue-50 rounded-lg border-l-4 border-green-500 p-3 md:p-4 shadow-sm">
            {/* Header */}
            <h4 className="text-xs md:text-sm font-bold text-green-900 uppercase tracking-wide mb-2 md:mb-3 flex items-center gap-2">
              <span className="text-base md:text-lg">📋</span>
              <span className="leading-tight">WhatsApp AI - Executive Summary</span>
            </h4>

            {/* Status Bar */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3 pb-3 border-b border-green-200">
              <span className="text-[10px] md:text-xs text-gray-700">
                Status: <span className="font-bold text-green-600">✅ Connected</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] md:text-xs text-gray-700">
                AI: <span className="font-bold text-purple-600">ON ({status.aiResponseRate}% auto)</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] md:text-xs text-gray-700">
                Today: <span className="font-semibold">{new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-3">
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-green-700">💬 Conversations:</span>{' '}
                <span className="text-gray-700">{stats.total || 0} hari ini ({stats.active || 0} active)</span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-purple-700">📨 Messages:</span>{' '}
                <span className="text-gray-700">{status.todayMessages} hari ini</span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-blue-700">🤖 AI Automation:</span>{' '}
                <span className="text-gray-700">
                  {status.aiResponseRate >= 80 ? (
                    <span className="text-green-600 font-semibold">Excellent ({status.aiResponseRate}%)</span>
                  ) : status.aiResponseRate >= 60 ? (
                    <span className="text-amber-600 font-semibold">Good ({status.aiResponseRate}%)</span>
                  ) : (
                    <span className="text-red-600 font-semibold">Perlu improve</span>
                  )}
                </span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-orange-700">⚡ Response Speed:</span>{' '}
                <span className="text-gray-700">
                  {stats.avgResponseTime < 60 ? (
                    <span className="text-green-600 font-semibold">Cepat ({formatResponseTime(stats.avgResponseTime)})</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Perlu ditingkatkan</span>
                  )}
                </span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-green-700">💰 Time Saved:</span>{' '}
                <span className="text-gray-700">~<span className="font-semibold text-green-600">{Math.round((status.todayMessages || 0) * (status.aiResponseRate / 100) * 2)} menit</span> hari ini</span>
              </div>
            </div>

            {/* Performance Status - Simplified */}
            <div className="border-t border-green-200 pt-2 md:pt-3">
              <p className="text-[10px] md:text-xs font-semibold text-gray-700 mb-2">📊 Performance Status:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* AI Automation */}
                {(() => {
                  const aiAutomation = status.aiResponseRate || 0;
                  const isExcellent = aiAutomation >= 80;
                  const isGood = aiAutomation >= 60;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{isExcellent ? '✅' : isGood ? '⚠️' : '❌'}</span>
                      <span className="text-[10px] md:text-xs text-gray-700">
                        <span className="font-medium">AI Automation:</span>{' '}
                        <span className={isExcellent ? 'text-green-600' : isGood ? 'text-amber-600' : 'text-red-600'}>
                          {aiAutomation}% auto-handled
                        </span>
                      </span>
                    </div>
                  );
                })()}

                {/* Response Quality */}
                {(() => {
                  const aiAccuracy = stats.aiAccuracy || 0;
                  const isExcellent = aiAccuracy >= 85;
                  const isGood = aiAccuracy >= 70;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{isExcellent ? '✅' : isGood ? '⚠️' : '❌'}</span>
                      <span className="text-[10px] md:text-xs text-gray-700">
                        <span className="font-medium">Response Quality:</span>{' '}
                        <span className={isExcellent ? 'text-green-600' : isGood ? 'text-amber-600' : 'text-red-600'}>
                          {aiAccuracy}% accuracy
                        </span>
                      </span>
                    </div>
                  );
                })()}

                {/* Customer Satisfaction */}
                {(() => {
                  const escalated = stats.escalated || 0;
                  const totalConversations = stats.total || 0;
                  const escalationRate = totalConversations > 0 ? (escalated / totalConversations) * 100 : 0;
                  const isExcellent = escalationRate <= 5;
                  const isGood = escalationRate <= 15;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{isExcellent ? '✅' : isGood ? '⚠️' : '❌'}</span>
                      <span className="text-[10px] md:text-xs text-gray-700">
                        <span className="font-medium">Customer Satisfaction:</span>{' '}
                        <span className={isExcellent ? 'text-green-600' : isGood ? 'text-amber-600' : 'text-red-600'}>
                          {escalated} escalated ({escalationRate.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Setup Guide - Only when NOT connected */}
        {!status.isConnected && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-3">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Setup Guide</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Connect WhatsApp</h3>
                  <p className="text-xs text-gray-600">Scan QR code</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Configure AI</h3>
                  <p className="text-xs text-gray-600">Customize personality</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Add Staff</h3>
                  <p className="text-xs text-gray-600">Grant access</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Go Live! 🚀</h3>
                  <p className="text-xs text-gray-600">Ready 24/7</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Value Proposition - Compact (Hidden for now) */}
        <div className="hidden bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4 rounded-xl border border-green-200">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Why WhatsApp AI?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/70 backdrop-blur p-3 rounded-lg">
              <div className="text-2xl mb-1">🚀</div>
              <h3 className="font-semibold text-gray-900 text-sm">Instant Response</h3>
              <p className="text-xs text-gray-600">Answer customer inquiries 24/7 without delay</p>
            </div>

            <div className="bg-white/70 backdrop-blur p-3 rounded-lg">
              <div className="text-2xl mb-1">📈</div>
              <h3 className="font-semibold text-gray-900 text-sm">Higher Conversion</h3>
              <p className="text-xs text-gray-600">+5% lead conversion with faster responses</p>
            </div>

            <div className="bg-white/70 backdrop-blur p-3 rounded-lg">
              <div className="text-2xl mb-1">⏰</div>
              <h3 className="font-semibold text-gray-900 text-sm">Save Time</h3>
              <p className="text-xs text-gray-600">2+ hours saved per staff member daily</p>
            </div>

            <div className="bg-white/70 backdrop-blur p-3 rounded-lg">
              <div className="text-2xl mb-1">💰</div>
              <h3 className="font-semibold text-gray-900 text-sm">Boost Revenue</h3>
              <p className="text-xs text-gray-600">Up to Rp 50M additional monthly revenue</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
