/**
 * WhatsApp AI Dashboard - Overview Page
 * Clean, simplified UI dengan single CTA per section
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

    // Optimistically update UI
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
        // Revert on error
        setAiConfig({
          ...aiConfig,
          customerChatEnabled: aiConfig.customerChatEnabled,
        });
        console.error('Failed to toggle AI');
      }
    } catch (error) {
      // Revert on error
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
    <div className="space-y-6">
      {/* Header - Simple, no buttons */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">WhatsApp AI Automation</h1>
        <p className="text-gray-600 mt-1">Asisten virtual 24/7 untuk customer dan staff operations</p>
      </div>

      {/* Connection Status - Single CTA */}
      <div className={`p-6 rounded-xl shadow-sm border-2 ${
        status.isConnected
          ? 'bg-green-50 border-green-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              status.isConnected ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <span className="text-3xl">
                {status.isConnected ? '✅' : '⚠️'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {status.isConnected ? 'WhatsApp Connected' : 'Setup Required'}
              </h2>
              {status.isConnected ? (
                <div className="text-sm text-gray-700 mt-1 space-y-1">
                  <p className="flex items-center">
                    <span className="font-medium mr-2">Phone:</span>
                    <span className="font-mono">{status.phoneNumber}</span>
                  </p>
                  {status.lastConnectedAt && (
                    <p className="text-gray-600">
                      Connected {new Date(status.lastConnectedAt).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-700 mt-1">
                  Connect your WhatsApp Business account to activate AI assistant
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* AI Auto-Answer Toggle */}
            {status.isConnected && aiConfig && (
              <div className="flex flex-col items-end">
                <button
                  onClick={handleToggleAI}
                  className={`relative inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all ${
                    aiConfig.customerChatEnabled
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                  }`}
                >
                  <span className="text-2xl mr-2">🤖</span>
                  <span>
                    {aiConfig.customerChatEnabled ? 'AI Auto-Answer: ON' : 'AI Auto-Answer: OFF'}
                  </span>
                </button>
                <p className="text-xs text-gray-600 mt-2">
                  {aiConfig.customerChatEnabled
                    ? 'AI will respond to customer messages automatically'
                    : 'AI responses are disabled - manual replies only'}
                </p>
              </div>
            )}
            {!status.isConnected && (
              <Link
                href="/dashboard/whatsapp-ai/setup"
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md hover:shadow-lg"
              >
                Setup WhatsApp →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Overview - Only show when connected */}
      {status.isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Conversations</h3>
              <span className="text-2xl">💬</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.active} active now</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Today Messages</h3>
              <span className="text-2xl">📨</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">{status.todayMessages}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.customerChats} customers · {stats.staffCommands} staff
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">AI Automation</h3>
              <span className="text-2xl">🤖</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{status.aiResponseRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.escalated} escalated to human
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Response Time</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {formatResponseTime(stats.avgResponseTime)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.aiAccuracy}% accuracy
            </p>
          </div>
        </div>
      )}

      {/* Main Navigation Cards - Primary actions */}
      {status.isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            href="/dashboard/whatsapp-ai/conversations"
            className="group bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">💬</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
              Conversations
            </h3>
            <p className="text-sm text-gray-600">
              Monitor customer chats and staff commands in real-time
            </p>
            <div className="mt-4 text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
              View all →
            </div>
          </Link>

          <Link
            href="/dashboard/whatsapp-ai/analytics"
            className="group bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-purple-600 transition-colors">
              Analytics
            </h3>
            <p className="text-sm text-gray-600">
              AI performance metrics and conversation insights
            </p>
            <div className="mt-4 text-purple-600 text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
              View reports →
            </div>
          </Link>

          <Link
            href="/dashboard/whatsapp-ai/staff"
            className="group bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:border-green-400 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">👥</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-green-600 transition-colors">
              Staff Management
            </h3>
            <p className="text-sm text-gray-600">
              Manage staff access and permissions for WhatsApp commands
            </p>
            <div className="mt-4 text-green-600 text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
              Manage staff →
            </div>
          </Link>

          <Link
            href="/dashboard/whatsapp-ai/config"
            className="group bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-orange-600 transition-colors">
              Configuration
            </h3>
            <p className="text-sm text-gray-600">
              AI personality, business hours, and feature settings
            </p>
            <div className="mt-4 text-orange-600 text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
              Configure →
            </div>
          </Link>
        </div>
      )}

      {/* Setup Guide - Only show when NOT connected */}
      {!status.isConnected && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Setup Guide</h2>
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-1">Connect WhatsApp</h3>
                <p className="text-gray-600">Scan QR code dengan WhatsApp Business account Anda</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-1">Configure AI</h3>
                <p className="text-gray-600">Customize AI name, personality, and welcome message</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-1">Add Staff</h3>
                <p className="text-gray-600">Grant staff access for vehicle upload via WhatsApp</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0 text-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-1">Go Live! 🚀</h3>
                <p className="text-gray-600">Your AI assistant is ready to serve customers 24/7</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Value Proposition */}
      <div className="bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-8 rounded-xl border-2 border-green-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Why WhatsApp AI?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/70 backdrop-blur p-4 rounded-lg">
            <div className="text-3xl mb-2">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-1">Instant Response</h3>
            <p className="text-sm text-gray-600">Answer customer inquiries 24/7 without delay</p>
          </div>

          <div className="bg-white/70 backdrop-blur p-4 rounded-lg">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold text-gray-900 mb-1">Higher Conversion</h3>
            <p className="text-sm text-gray-600">+5% lead conversion with faster responses</p>
          </div>

          <div className="bg-white/70 backdrop-blur p-4 rounded-lg">
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="font-semibold text-gray-900 mb-1">Save Time</h3>
            <p className="text-sm text-gray-600">2+ hours saved per staff member daily</p>
          </div>

          <div className="bg-white/70 backdrop-blur p-4 rounded-lg">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-900 mb-1">Boost Revenue</h3>
            <p className="text-sm text-gray-600">Up to Rp 50M additional monthly revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
}
