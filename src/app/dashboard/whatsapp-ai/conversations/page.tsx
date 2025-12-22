/**
 * WhatsApp AI Conversations Monitoring
 * Monitor customer chats dan staff commands
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Send manual message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;
      const parsedUser = JSON.parse(storedUser);

      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          message: messageInput,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessageInput('');
        // Reload messages
        loadMessages(selectedConversation.id);
      } else {
        alert('Gagal mengirim pesan: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  };

  // Handle attachment selection
  const handleAttachment = (type: string) => {
    setShowAttachmentMenu(false);
    // TODO: Implement attachment handling
    alert(`Fitur ${type} akan segera hadir!`);
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

  // Format WhatsApp JID to readable phone number
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '-';

    // Remove @lid, @s.whatsapp.net, or other WhatsApp suffixes
    let cleaned = phone.split('@')[0];

    // Remove any device suffix (e.g., :123)
    cleaned = cleaned.split(':')[0];

    // If it's a LID (linked ID), show as is with marker
    if (phone.includes('@lid')) {
      return `WA: ${cleaned.slice(-8)}...`;
    }

    // Extract phone number - remove any non-digits
    const digits = cleaned.replace(/\D/g, '');

    // If starts with 62 (Indonesia), format nicely
    if (digits.startsWith('62') && digits.length >= 10) {
      const localNumber = digits.substring(2);
      // Format: +62 812 3456 7890
      if (localNumber.length >= 9) {
        const p1 = localNumber.substring(0, 3);
        const p2 = localNumber.substring(3, 7);
        const p3 = localNumber.substring(7);
        return `+62 ${p1} ${p2} ${p3}`.trim();
      }
      return `+62 ${localNumber}`;
    }

    // If starts with other country codes, show with +
    if (digits.length >= 10) {
      return `+${digits}`;
    }

    // Fallback - show last 10 digits with formatting
    if (digits.length > 10) {
      const last10 = digits.slice(-10);
      return `...${last10.substring(0, 3)} ${last10.substring(3, 7)} ${last10.substring(7)}`;
    }

    return digits || phone;
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
                          {conv.customerName || formatPhoneNumber(conv.customerPhone)}
                        </h3>
                        <p className="text-xs text-gray-500">{formatPhoneNumber(conv.customerPhone)}</p>
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
                      {selectedConversation.customerName || formatPhoneNumber(selectedConversation.customerPhone)}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {formatPhoneNumber(selectedConversation.customerPhone)} •{' '}
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
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 shadow-sm ${
                            msg.direction === 'inbound'
                              ? 'bg-white text-gray-900 rounded-tl-none'
                              : msg.aiResponse
                              ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none'
                              : 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                          }`}
                        >
                          {msg.direction === 'inbound' && (
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-semibold text-green-700">
                                {msg.senderType === 'staff' ? '👨‍💼 Staff' : '👤 Customer'}
                              </span>
                              {msg.intent && (
                                <span className="text-xs text-gray-500">• {msg.intent}</span>
                              )}
                            </div>
                          )}
                          {msg.direction === 'outbound' && (
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-xs font-semibold text-blue-700">
                                {msg.senderType === 'ai' ? '🤖 AI Bot' : '👨‍💼 Admin'}
                              </span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className="flex items-center justify-end mt-1 space-x-1">
                            <span className="text-[10px] text-gray-500">
                              {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.direction === 'outbound' && (
                              <span className="text-blue-500 text-xs">✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-3 border-t border-gray-200 bg-[#f0f2f5]">
                <div className="flex items-center space-x-2">
                  {/* Attachment Button */}
                  <div className="relative" ref={attachmentMenuRef}>
                    <button
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Lampiran"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>

                    {/* Attachment Menu */}
                    {showAttachmentMenu && (
                      <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-50">
                        <button
                          onClick={() => handleAttachment('dokumen')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">📄</span>
                          <div>
                            <p className="text-sm font-medium">Dokumen</p>
                            <p className="text-xs text-gray-500">PDF, Word, Excel</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('foto')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">📷</span>
                          <div>
                            <p className="text-sm font-medium">Foto</p>
                            <p className="text-xs text-gray-500">JPG, PNG, GIF</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('kontak')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">👤</span>
                          <div>
                            <p className="text-sm font-medium">Kontak</p>
                            <p className="text-xs text-gray-500">Kirim kontak sales</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('acara')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">📅</span>
                          <div>
                            <p className="text-sm font-medium">Acara</p>
                            <p className="text-xs text-gray-500">Info acara showroom</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('emoji')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">😊</span>
                          <div>
                            <p className="text-sm font-medium">Stiker & Emoji</p>
                            <p className="text-xs text-gray-500">Emotikon</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ketik pesan..."
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Kirim"
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
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
