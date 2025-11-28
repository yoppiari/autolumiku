/**
 * WhatsApp AI Conversations Monitoring
 * Monitor customer chats dan staff commands
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  customerPhone: string;
  customerName?: string;
  isStaff: boolean;
  conversationType: string;
  lastIntent?: string;
  status: string;
  lastMessageAt: string;
  escalatedTo?: string;
  messageCount: number;
  unreadCount: number;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  sender: string;
  senderType: string;
  content: string;
  intent?: string;
  aiResponse: boolean;
  createdAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'staff' | 'escalated'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true);

      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.error('No user found');
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        const response = await fetch(`/api/v1/whatsapp-ai/conversations?tenantId=${tenantId}`);
        const data = await response.json();

        if (data.success) {
          setConversations(data.data);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);

  // Load messages for selected conversation
  const loadMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/conversations/${conversationId}/messages`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'customer' && !conv.isStaff) ||
      (filterType === 'staff' && conv.isStaff) ||
      (filterType === 'escalated' && conv.escalatedTo);

    const matchesSearch =
      conv.customerPhone.includes(searchTerm) ||
      conv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesSearch;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('id-ID');
  };

  const getIntentBadgeColor = (intent?: string) => {
    if (!intent) return 'bg-gray-100 text-gray-800';
    if (intent.startsWith('customer')) return 'bg-blue-100 text-blue-800';
    if (intent.startsWith('staff')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
        <p className="text-gray-600 mt-1">Monitor customer chats dan staff commands</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Conversations List */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by phone or name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-3"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filterType === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filterType === 'customer'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => setFilterType('staff')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filterType === 'staff'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Staff
              </button>
              <button
                onClick={() => setFilterType('escalated')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filterType === 'escalated'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Escalated
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?.id === conv.id ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          conv.isStaff ? 'bg-green-100' : 'bg-blue-100'
                        }`}
                      >
                        <span className="text-lg">{conv.isStaff ? '👨‍💼' : '👤'}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {conv.customerName || conv.customerPhone}
                        </h3>
                        <p className="text-xs text-gray-500">{conv.customerPhone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatTime(conv.lastMessageAt)}</p>
                      {conv.unreadCount > 0 && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getIntentBadgeColor(
                        conv.lastIntent
                      )}`}
                    >
                      {conv.lastIntent || 'unknown'}
                    </span>
                    {conv.escalatedTo && (
                      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Escalated
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedConversation.customerName || selectedConversation.customerPhone}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.customerPhone} •{' '}
                      {selectedConversation.isStaff ? 'Staff' : 'Customer'}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedConversation.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-md rounded-lg p-3 ${
                          msg.direction === 'inbound'
                            ? 'bg-gray-100 text-gray-900'
                            : msg.aiResponse
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium">
                            {msg.senderType === 'ai' ? '🤖 AI' : msg.sender}
                          </span>
                          {msg.intent && (
                            <span className="text-xs opacity-75">• {msg.intent}</span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input (Optional - untuk manual reply) */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Type a message (manual reply)..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled
                  />
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    disabled
                  >
                    Send
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Manual reply feature coming soon. AI handles responses automatically.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">💬</p>
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
