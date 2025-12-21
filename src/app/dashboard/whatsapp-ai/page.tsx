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
  const [isLoading, setIsLoading] = useState(true);
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

        const [statusResponse, statsResponse, configResponse] = await Promise.all([
          fetch(`/api/v1/whatsapp-ai/status?tenantId=${currentTenantId}`),
          fetch(`/api/v1/whatsapp-ai/stats?tenantId=${currentTenantId}`),
          fetch(`/api/v1/whatsapp-ai/config?tenantId=${currentTenantId}`),
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
    if (!aiConfig || !tenantId) return;

    setAiConfig({
      ...aiConfig,
      customerChatEnabled: !aiConfig.customerChatEnabled,
    });

    try {
      const response = await fetch('/api/v1/whatsapp-ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          customerChatEnabled: !aiConfig.customerChatEnabled,
        }),
      });

      if (!response.ok) {
        setAiConfig({
          ...aiConfig,
          customerChatEnabled: aiConfig.customerChatEnabled,
        });
        console.error('Failed to toggle AI');
      }
    } catch (error) {
      setAiConfig({
        ...aiConfig,
        customerChatEnabled: aiConfig.customerChatEnabled,
      });
      console.error('Error toggling AI:', error);
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
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp AI Automation</h1>
        <p className="text-gray-600 text-sm">Asisten virtual 24/7 untuk customer dan staff operations</p>
      </div>

      {/* Connection Status - Compact */}
      <div className={`p-4 rounded-xl shadow-sm border-2 mb-3 flex-shrink-0 ${
        status.isConnected
          ? 'bg-green-50 border-green-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              status.isConnected ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <span className="text-2xl">
                {status.isConnected ? '✅' : '⚠️'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {status.isConnected ? 'WhatsApp Connected' : 'Setup Required'}
              </h2>
              {status.isConnected ? (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Phone:</span> {status.phoneNumber}
                  {status.lastConnectedAt && (
                    <span className="ml-2 text-gray-500">
                      Connected {new Date(status.lastConnectedAt).toLocaleString('id-ID')}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  Connect your WhatsApp Business account to activate AI assistant
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {status.isConnected && aiConfig && (
              <button
                onClick={handleToggleAI}
                className={`relative inline-flex items-center px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-sm ${
                  aiConfig.customerChatEnabled
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                }`}
              >
                <span className="text-lg mr-2">🤖</span>
                <span>
                  {aiConfig.customerChatEnabled ? 'AI Auto-Answer: ON' : 'AI Auto-Answer: OFF'}
                </span>
              </button>
            )}
            {!status.isConnected && (
              <Link
                href="/dashboard/whatsapp-ai/setup"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md text-sm"
              >
                Setup WhatsApp →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable if needed */}
      <div className="flex-1 overflow-auto">
        {/* Stats Overview - Compact */}
        {status.isConnected && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-medium text-gray-500">Conversations</h3>
                <span className="text-xl">💬</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <p className="text-xs text-gray-500">{stats.active} active now</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-medium text-gray-500">Today Messages</h3>
                <span className="text-xl">📨</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{status.todayMessages}</div>
              <p className="text-xs text-gray-500">
                {stats.customerChats} customers · {stats.staffCommands} staff
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-medium text-gray-500">AI Automation</h3>
                <span className="text-xl">🤖</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{status.aiResponseRate}%</div>
              <p className="text-xs text-gray-500">
                {stats.escalated} escalated to human
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-medium text-gray-500">Response Time</h3>
                <span className="text-xl">⚡</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatResponseTime(stats.avgResponseTime)}
              </div>
              <p className="text-xs text-gray-500">
                {stats.aiAccuracy}% accuracy
              </p>
            </div>
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

        {/* Value Proposition - Compact */}
        <div className="bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4 rounded-xl border border-green-200">
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
