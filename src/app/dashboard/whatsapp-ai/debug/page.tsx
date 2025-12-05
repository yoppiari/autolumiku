/**
 * WhatsApp AI - Debug Dashboard
 * Real-time debugging untuk webhook dan message processing
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface WebhookLog {
  account: {
    clientId: string;
    phoneNumber: string;
    webhookUrl: string;
    isActive: boolean;
    connectionStatus: string;
    lastConnectedAt: string;
  };
  stats: {
    totalConversations: number;
    totalMessages: number;
    lastMessageAt: string | null;
  };
  conversations: any[];
  recentMessages: any[];
}

export default function WhatsAppDebugPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [logs, setLogs] = useState<WebhookLog | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('Halo, test pesan dari debug');
  const [testPhone, setTestPhone] = useState('6281234567890');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTenantId(parsedUser.tenantId);
    }
  }, []);

  const loadLogs = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/webhook-logs?tenantId=${tenantId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load logs');
      }

      setLogs(data.data);
    } catch (err: any) {
      console.error('Load logs error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runTest = async () => {
    if (!tenantId) return;

    setIsTesting(true);
    setError('');
    setTestResult(null);

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/test-webhook?tenantId=${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage,
          phone: testPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test failed');
      }

      setTestResult(data.data);

      // Reload logs after test
      setTimeout(loadLogs, 1000);
    } catch (err: any) {
      console.error('Test error:', err);
      setError(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadLogs();
      // Auto-refresh every 10 seconds
      const interval = setInterval(loadLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [tenantId]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/whatsapp-ai"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to WhatsApp AI Dashboard
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp AI Debug</h1>
            <p className="text-gray-600 mt-1">Real-time webhook monitoring dan testing</p>
          </div>
          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Connection Status */}
      {logs && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📡 Connection Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold">
                {logs.account.isActive ? (
                  <span className="text-green-600">✅ Active</span>
                ) : (
                  <span className="text-red-600">❌ Inactive</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone Number</p>
              <p className="text-lg font-semibold">{logs.account.phoneNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Connection</p>
              <p className="text-lg font-semibold capitalize">{logs.account.connectionStatus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Client ID</p>
              <p className="text-sm font-mono">{logs.account.clientId.substring(0, 16)}...</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Webhook URL:</p>
            <p className="text-sm font-mono break-all">
              {logs.account.webhookUrl || '❌ NOT SET'}
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      {logs && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Statistics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Total Conversations</p>
              <p className="text-2xl font-bold text-blue-900">{logs.stats.totalConversations}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Total Messages</p>
              <p className="text-2xl font-bold text-green-900">{logs.stats.totalMessages}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Last Message</p>
              <p className="text-sm font-semibold text-purple-900">
                {logs.stats.lastMessageAt
                  ? new Date(logs.stats.lastMessageAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Webhook */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🧪 Test Webhook</h2>
        <p className="text-sm text-gray-600 mb-4">
          Simulate incoming message untuk test message processing pipeline
        </p>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Phone Number
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="6281234567890"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Message</label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Halo, test pesan"
            />
          </div>
        </div>

        <button
          onClick={runTest}
          disabled={isTesting || !tenantId}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
        >
          {isTesting ? 'Testing...' : '▶️ Run Test'}
        </button>

        {testResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Test Result:</h3>
            <pre className="text-xs overflow-auto max-h-64 bg-white p-3 rounded border">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Recent Messages */}
      {logs && logs.recentMessages.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💬 Recent Messages</h2>
          <div className="space-y-3">
            {logs.recentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg border-2 ${
                  msg.direction === 'inbound'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        msg.direction === 'inbound'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {msg.direction === 'inbound' ? '📥 IN' : '📤 OUT'}
                    </span>
                    <span className="text-sm font-medium">{msg.customerPhone}</span>
                    {msg.aiResponse && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        🤖 AI
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{msg.content}</p>
                {msg.intent && (
                  <p className="text-xs text-gray-500 mt-1">Intent: {msg.intent}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      {logs && logs.conversations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">👥 Recent Conversations</h2>
          <div className="space-y-3">
            {logs.conversations.map((conv) => (
              <div key={conv.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {conv.customerName || conv.customerPhone}
                    </p>
                    <p className="text-sm text-gray-600">{conv.messageCount} messages</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        conv.status === 'active' ? 'text-green-600' : 'text-gray-600'
                      }`}
                    >
                      {conv.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(conv.lastMessageAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {logs && logs.recentMessages.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <span className="text-6xl mb-4 block">📭</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Messages Yet</h3>
          <p className="text-gray-600 mb-4">
            Webhook belum menerima message apapun. Coba:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 mb-6">
            <li>1. Pastikan WhatsApp sudah connected</li>
            <li>2. Cek webhook URL sudah ter-register di Aimeow</li>
            <li>3. Kirim test message ke nomor WhatsApp</li>
            <li>4. Atau gunakan Test Webhook di atas</li>
          </ul>
        </div>
      )}
    </div>
  );
}
