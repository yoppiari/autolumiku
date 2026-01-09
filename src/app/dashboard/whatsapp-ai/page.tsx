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
  todayConversations: number;
  todayMessages: number;
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
    todayConversations: 0,
    todayMessages: 0,
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
    <div className="p-4 md:p-6 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header - Extra left padding on mobile to avoid hamburger menu */}
      <div className="mb-2 md:mb-3 flex-shrink-0 pl-10 md:pl-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl md:text-3xl">💬</span>
            WhatsApp AI Dashboard
          </h1>
          <p className="text-gray-600 text-[10px] md:text-sm mt-0.5">Asisten virtual 24/7 untuk customer dan staff operations</p>
        </div>
      </div>

      {/* Connection Status - With AI Controls inside */}
      <div className={`p-3 md:p-4 rounded-xl shadow-sm border-2 mb-3 md:mb-4 flex-shrink-0 transition-all ${status.isConnected
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
        : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
        }`}>
        {/* Mobile: Stack vertically, Desktop: Horizontal */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Connection Info */}
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${aiHealth?.status === 'active' ? 'animate-pulse drop-shadow-[0_0_8px_rgba(37,211,102,0.8)]' : ''
              }`}>
              {status.isConnected && (status as any).profilePicUrl ? (
                <img
                  src={(status as any).profilePicUrl}
                  alt={(status as any).pushName || 'WhatsApp'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span className="text-xl">
                  {status.isConnected ? (
                    <svg className={`w-10 h-10 text-[#25D366] transition-all duration-700 ${aiHealth?.status === 'active' ? 'filter drop-shadow-[0_0_5px_rgba(37,211,102,0.6)]' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  ) : '⚠️'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  {status.isConnected ? 'WhatsApp Connected' : 'Setup Required'}
                </h2>
                {status.isConnected && (
                  <div className={`flex items-center px-2 py-0.5 rounded-full text-white text-[10px] md:text-xs font-medium whitespace-nowrap ${getAIStatusColor(aiHealth?.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${aiHealth?.status === 'active' ? 'animate-pulse bg-white' : 'bg-white/60'}`}></span>
                    {getAIStatusText(aiHealth?.status)}
                  </div>
                )}
              </div>
              {status.isConnected ? (
                <div className="text-xs text-gray-700 flex items-center flex-wrap gap-2">
                  <span className="font-medium">Phone:</span>
                  <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-green-200">
                    <svg className="w-3 h-3 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span className="font-bold text-green-700">{status.phoneNumber}</span>
                  </div>
                  <a
                    href={`https://wa.me/${status.phoneNumber?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 ml-1"
                  >
                    Open Chat ↗
                  </a>
                  {status.lastConnectedAt && (
                    <span className="text-gray-500 ml-auto md:ml-2">
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
              {/* AI Toggle Button - Links to config page */}
              <Link
                href="/dashboard/whatsapp-ai/config"
                className={`relative inline-flex items-center px-3 md:px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-sm whitespace-nowrap ${aiHealth?.enabled !== false
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
          <div className={`p-4 rounded-xl shadow-sm border-2 mb-3 flex-shrink-0 ${aiHealth.status === 'disabled' ? 'bg-gray-50 border-gray-300' :
            aiHealth.status === 'degraded' ? 'bg-yellow-50 border-yellow-300' :
              'bg-red-50 border-red-300'
            }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${aiHealth.status === 'disabled' ? 'bg-gray-100' :
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
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${aiHealth.enabled
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

        {/* Navigation Cards - Improved */}
        {status.isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
            <Link
              href="/dashboard/whatsapp-ai/conversations"
              className="group bg-white p-3 md:p-4 rounded-xl shadow-sm border-2 border-gray-100 hover:border-blue-500 hover:shadow-md transition-all transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl md:text-4xl">💬</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm md:text-base text-gray-900 group-hover:text-blue-600 transition-colors mb-0.5 truncate">
                    Conversations
                  </h3>
                  <p className="text-[10px] md:text-xs text-gray-600 leading-tight line-clamp-1">
                    Monitor chats in real-time
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai/analytics"
              className="group bg-white p-3 md:p-4 rounded-xl shadow-sm border-2 border-gray-100 hover:border-purple-500 hover:shadow-md transition-all transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl md:text-4xl">📊</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm md:text-base text-gray-900 group-hover:text-purple-600 transition-colors mb-0.5 truncate">
                    Analytics
                  </h3>
                  <p className="text-[10px] md:text-xs text-gray-600 leading-tight line-clamp-1">
                    Performance metrics
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai/config"
              className="group bg-white p-3 md:p-4 rounded-xl shadow-sm border-2 border-gray-100 hover:border-orange-500 hover:shadow-md transition-all transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl md:text-4xl">⚙️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm md:text-base text-gray-900 group-hover:text-orange-600 transition-colors mb-0.5 truncate">
                    Configuration
                  </h3>
                  <p className="text-[10px] md:text-xs text-gray-600 leading-tight line-clamp-1">
                    AI behavior settings
                  </p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Executive Summary Card - Improved */}
        {status.isConnected && (
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 rounded-xl border-l-4 border-green-600 p-3 md:p-4 shadow-sm">
            {/* Header */}
            <h4 className="text-xs md:text-sm font-bold text-green-900 uppercase tracking-wide mb-2 md:mb-3 flex items-center gap-2">
              <span className="text-lg md:text-xl">📋</span>
              <span className="leading-tight">Executive Summary</span>
            </h4>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-5">
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-green-700">💬 Conversations:</span>{' '}
                <span className="text-gray-700">{(stats as any).todayConversations || 0} hari ini ({stats.active || 0} active)</span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-purple-700">📨 Messages:</span>{' '}
                <span className="text-gray-700">{(stats as any).todayMessages || status.todayMessages || 0} hari ini</span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-blue-700">🤖 AI Automation:</span>{' '}
                <span className="text-gray-700">
                  {status.aiResponseRate >= 80 ? (
                    <span className="text-green-600 font-semibold">Excellent ({status.aiResponseRate}%)</span>
                  ) : status.aiResponseRate >= 60 ? (
                    <span className="text-amber-600 font-semibold">Good ({status.aiResponseRate}%)</span>
                  ) : status.aiResponseRate > 0 ? (
                    <span className="text-red-600 font-semibold">Perlu improve ({status.aiResponseRate}%)</span>
                  ) : (
                    <span className="text-gray-400 font-medium">No Data</span>
                  )}
                </span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-orange-700">⚡ Response Speed:</span>{' '}
                <span className="text-gray-700">
                  {stats.avgResponseTime > 0 ? (
                    stats.avgResponseTime < 60 ? (
                      <span className="text-green-600 font-semibold">Cepat ({formatResponseTime(stats.avgResponseTime)})</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Slow ({formatResponseTime(stats.avgResponseTime)})</span>
                    )
                  ) : (
                    <span className="text-gray-400 font-medium">No Data</span>
                  )}
                </span>
              </div>
              <div className="text-[10px] md:text-xs leading-snug">
                <span className="font-bold text-green-700">💰 Time Saved:</span>{' '}
                <span className="text-gray-700">~<span className="font-semibold text-green-600">{Math.round(((stats as any).todayMessages || status.todayMessages || 0) * (status.aiResponseRate / 100) * 1.5)} menit</span> hari ini</span>
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
