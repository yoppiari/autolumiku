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

interface TenantInfo {
  name: string;
  address?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  email?: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName?: string;
  role: string;
  phone?: string;
  email?: string;
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
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [imageUploadMode, setImageUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentUploadMode, setDocumentUploadMode] = useState<'file' | 'url'>('file');
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentUrlInput, setDocumentUrlInput] = useState('');
  const [documentCaptionInput, setDocumentCaptionInput] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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

  // Load tenant info and team members for contact info
  useEffect(() => {
    const loadTenantAndTeam = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        // Get auth token for authenticated API calls
        const authToken = localStorage.getItem('authToken');

        // Fetch tenant info and team members in parallel
        const [tenantResponse, teamResponse] = await Promise.all([
          fetch(`/api/v1/tenants/${tenantId}`),
          fetch(`/api/v1/users?tenantId=${tenantId}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }),
        ]);

        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          const tenant = tenantData.data || tenantData.tenant;
          if (tenant) {
            setTenantInfo({
              name: tenant.name || '',
              address: tenant.address || '',
              phoneNumber: tenant.phoneNumber || '',
              whatsappNumber: tenant.whatsappNumber || '',
              email: tenant.email || '',
            });
          }
        }

        if (teamResponse.ok) {
          const teamData = await teamResponse.json();
          // API returns { success: true, data: { users: [...], stats: {...} } }
          const usersList = teamData.data?.users || teamData.data || [];
          if (teamData.success && usersList.length > 0) {
            // Filter to get staff with phone contact info
            const members = usersList
              .filter((m: any) => m.phone)
              .map((m: any) => ({
                id: m.id,
                firstName: m.firstName || '',
                lastName: m.lastName || '',
                role: m.role || '',
                phone: m.phone || '',
                email: m.email || '',
              }));
            setTeamMembers(members);
          }
        }
      } catch (error) {
        console.error('Error loading tenant/team data:', error);
      }
    };

    loadTenantAndTeam();
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

    switch (type) {
      case 'foto':
        // Show modal to enter image URL
        setShowImageUrlModal(true);
        break;
      case 'dokumen':
        setShowDocumentModal(true);
        break;
      case 'kontak':
        // Send sales contact info from real tenant/team data
        const tenantName = tenantInfo?.name || 'Showroom';
        const address = tenantInfo?.address || '-';

        // Build contact list from team members
        let contactList = '';
        if (teamMembers.length > 0) {
          contactList = teamMembers
            .slice(0, 5) // Max 5 contacts
            .map((m) => {
              const name = `${m.firstName} ${m.lastName || ''}`.trim();
              const role = m.role?.replace('_', ' ') || '';
              // Format phone: add + prefix if starts with 62
              const phone = m.phone || '';
              const formattedPhone = phone.startsWith('62') ? `+${phone}` : phone;
              return `• ${name}${role ? ` (${role})` : ''}: ${formattedPhone}`;
            })
            .join('\n');
        } else {
          // Fallback to tenant contact
          contactList = tenantInfo?.whatsappNumber || tenantInfo?.phoneNumber || '-';
        }

        const contactMsg = `📞 *Kontak Sales ${tenantName}*\n\nHubungi kami di:\n${contactList}\n\n📍 Alamat: ${address}`;
        setMessageInput(contactMsg);
        break;
      case 'acara':
        const eventTenantName = tenantInfo?.name || 'Showroom';
        const eventMsg = `🎉 *Info Acara ${eventTenantName}*\n\nKami sedang tidak ada acara khusus saat ini.\n\nNantikan promo dan event menarik dari kami!`;
        setMessageInput(eventMsg);
        break;
      case 'emoji':
        // Show emoji picker modal
        setShowEmojiPicker(true);
        break;
      default:
        alert(`Fitur ${type} akan segera hadir!`);
    }
  };

  // Handle file selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipe file tidak valid. Hanya JPEG, PNG, WebP, dan GIF yang diperbolehkan.');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Send image (either by file upload or URL)
  const handleSendImage = async () => {
    if (!selectedConversation || isSending || isUploading) return;

    // Validate based on mode
    if (imageUploadMode === 'url' && !imageUrlInput.trim()) {
      alert('Masukkan URL gambar');
      return;
    }
    if (imageUploadMode === 'file' && !selectedFile) {
      alert('Pilih file gambar');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const parsedUser = JSON.parse(storedUser);

    let finalImageUrl = imageUrlInput;

    // If file mode, upload first
    if (imageUploadMode === 'file' && selectedFile) {
      setIsUploading(true);
      setUploadProgress('Mengupload gambar...');

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('tenantId', parsedUser.tenantId);

        const uploadResponse = await fetch('/api/v1/whatsapp-ai/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          alert('Gagal upload gambar: ' + (uploadData.error || 'Unknown error'));
          setIsUploading(false);
          setUploadProgress('');
          return;
        }

        finalImageUrl = uploadData.data.url;
        setUploadProgress('Mengirim gambar...');
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Gagal upload gambar');
        setIsUploading(false);
        setUploadProgress('');
        return;
      }
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          imageUrl: finalImageUrl,
          caption: imageCaptionInput || '',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Reset all states
        setImageUrlInput('');
        setImageCaptionInput('');
        setSelectedFile(null);
        setShowImageUrlModal(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        loadMessages(selectedConversation.id);
      } else {
        alert('Gagal mengirim foto: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending image:', error);
      alert('Gagal mengirim foto');
    } finally {
      setIsSending(false);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Handle document file selection
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type by extension
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
      if (!allowedExtensions.includes(extension)) {
        alert('Tipe file tidak valid. Hanya PDF, Word, Excel, dan PowerPoint yang diperbolehkan.');
        return;
      }
      // Validate file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 25MB.');
        return;
      }
      setSelectedDocument(file);
    }
  };

  // Send document (either by file upload or URL)
  const handleSendDocument = async () => {
    if (!selectedConversation || isSending || isUploadingDocument) return;

    // Validate based on mode
    if (documentUploadMode === 'url' && !documentUrlInput.trim()) {
      alert('Masukkan URL dokumen');
      return;
    }
    if (documentUploadMode === 'file' && !selectedDocument) {
      alert('Pilih file dokumen');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const parsedUser = JSON.parse(storedUser);

    let finalDocumentUrl = documentUrlInput;
    let filename = '';

    // If file mode, upload first
    if (documentUploadMode === 'file' && selectedDocument) {
      setIsUploadingDocument(true);
      setUploadProgress('Mengupload dokumen...');
      filename = selectedDocument.name;

      try {
        const formData = new FormData();
        formData.append('file', selectedDocument);
        formData.append('tenantId', parsedUser.tenantId);

        const uploadResponse = await fetch('/api/v1/whatsapp-ai/upload-document', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          alert('Gagal upload dokumen: ' + (uploadData.error || 'Unknown error'));
          setIsUploadingDocument(false);
          setUploadProgress('');
          return;
        }

        finalDocumentUrl = uploadData.data.url;
        filename = uploadData.data.filename;
        setUploadProgress('Mengirim dokumen...');
      } catch (error) {
        console.error('Error uploading document:', error);
        alert('Gagal upload dokumen');
        setIsUploadingDocument(false);
        setUploadProgress('');
        return;
      }
    } else {
      // For URL mode, extract filename from URL
      try {
        const urlPath = new URL(documentUrlInput).pathname;
        filename = urlPath.split('/').pop() || 'document';
      } catch {
        filename = 'document';
      }
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          documentUrl: finalDocumentUrl,
          filename: filename,
          caption: documentCaptionInput || '',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Reset all states
        setDocumentUrlInput('');
        setDocumentCaptionInput('');
        setSelectedDocument(null);
        setShowDocumentModal(false);
        if (documentInputRef.current) {
          documentInputRef.current.value = '';
        }
        loadMessages(selectedConversation.id);
      } else {
        alert('Gagal mengirim dokumen: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Gagal mengirim dokumen');
    } finally {
      setIsSending(false);
      setIsUploadingDocument(false);
      setUploadProgress('');
    }
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
    <div className="p-4 h-screen flex flex-col overflow-hidden">
      {/* Header - Compact */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 text-sm">
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Conversations</h1>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">Monitor customer chats dan staff commands</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden min-h-0">
        {/* Conversations List */}
        <div className="col-span-4 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Filters - Compact */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by phone or name..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  filterType === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  filterType === 'customer'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => setFilterType('staff')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  filterType === 'staff'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Staff
              </button>
              <button
                onClick={() => setFilterType('escalated')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
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
              <div className="p-4 text-center text-gray-500 text-sm">
                <p>No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?.id === conv.id ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 ${
                          conv.isStaff ? 'bg-green-100' : 'bg-blue-100'
                        }`}
                      >
                        <span className="text-sm">{conv.isStaff ? '👨‍💼' : '👤'}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm truncate">
                          {conv.customerName || formatPhoneNumber(conv.customerPhone)}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`inline-block px-1.5 py-0 rounded text-[10px] font-medium ${getIntentBadgeColor(
                              conv.lastIntent
                            )}`}
                          >
                            {conv.lastIntent?.replace('customer_', '').replace('staff_', '') || '?'}
                          </span>
                          {conv.escalatedTo && (
                            <span className="inline-block px-1.5 py-0 bg-red-100 text-red-800 rounded text-[10px] font-medium">
                              Esc
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-[10px] text-gray-500">{formatTime(conv.lastMessageAt)}</p>
                      {conv.unreadCount > 0 && (
                        <span className="inline-block mt-0.5 px-1.5 py-0 bg-green-600 text-white text-[10px] rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="col-span-8 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Conversation Header - Compact */}
              <div className="px-3 py-2 border-b border-gray-200 bg-[#f0f2f5]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                      selectedConversation.isStaff ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <span className="text-sm">{selectedConversation.isStaff ? '👨‍💼' : '👤'}</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        {selectedConversation.customerName || formatPhoneNumber(selectedConversation.customerPhone)}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.isStaff ? 'Staff' : 'Customer'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
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
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#e5ddd5]">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-4 text-sm">
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
                          className={`max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm ${
                            msg.direction === 'inbound'
                              ? 'bg-white text-gray-900 rounded-tl-none'
                              : msg.aiResponse
                              ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none'
                              : 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                          }`}
                        >
                          {msg.direction === 'inbound' && (
                            <div className="flex items-center space-x-1 mb-0.5">
                              <span className="text-[10px] font-semibold text-green-700">
                                {msg.senderType === 'staff' ? '👨‍💼' : '👤'}
                              </span>
                              {msg.intent && (
                                <span className="text-[10px] text-gray-500">{msg.intent.replace('customer_', '').replace('staff_', '')}</span>
                              )}
                            </div>
                          )}
                          {msg.direction === 'outbound' && (
                            <div className="flex items-center space-x-1 mb-0.5">
                              <span className="text-[10px] font-semibold text-blue-700">
                                {msg.senderType === 'ai' ? '🤖' : '👨‍💼'}
                              </span>
                            </div>
                          )}
                          <p className="text-xs whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className="flex items-center justify-end mt-0.5 space-x-1">
                            <span className="text-[9px] text-gray-500">
                              {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.direction === 'outbound' && (
                              <span className="text-blue-500 text-[10px]">✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input - Compact */}
              <div className="px-2 py-2 border-t border-gray-200 bg-[#f0f2f5]">
                <div className="flex items-center space-x-2">
                  {/* Attachment Button */}
                  <div className="relative" ref={attachmentMenuRef}>
                    <button
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Lampiran"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="p-1.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Kirim"
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-2xl mb-1">💬</p>
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for images */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Hidden file input for documents */}
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
      />

      {/* Image Upload Modal */}
      {showImageUrlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">📷 Kirim Foto</h3>

            {/* Mode Tabs */}
            <div className="flex mb-4 border-b border-gray-200">
              <button
                onClick={() => setImageUploadMode('file')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  imageUploadMode === 'file'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 Upload File
              </button>
              <button
                onClick={() => setImageUploadMode('url')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  imageUploadMode === 'url'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔗 Paste URL
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload Mode */}
              {imageUploadMode === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Gambar *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="text-4xl">🖼️</div>
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-4xl">📤</div>
                        <p className="text-sm text-gray-600">
                          Klik untuk memilih gambar
                        </p>
                        <p className="text-xs text-gray-400">
                          JPG, PNG, WebP, GIF (maks 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Bisa dari smartphone, laptop, atau penyimpanan lokal
                  </p>
                </div>
              )}

              {/* URL Mode */}
              {imageUploadMode === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Gambar *
                  </label>
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste URL gambar dari Google Drive, Dropbox, atau website lain
                  </p>
                </div>
              )}

              {/* Caption - shared for both modes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (opsional)
                </label>
                <input
                  type="text"
                  value={imageCaptionInput}
                  onChange={(e) => setImageCaptionInput(e.target.value)}
                  placeholder="Keterangan gambar..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Progress indicator */}
            {(isUploading || isSending) && uploadProgress && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm text-blue-700">{uploadProgress}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowImageUrlModal(false);
                  setImageUrlInput('');
                  setImageCaptionInput('');
                  setSelectedFile(null);
                  setUploadProgress('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={isUploading || isSending}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSendImage}
                disabled={
                  (imageUploadMode === 'file' && !selectedFile) ||
                  (imageUploadMode === 'url' && !imageUrlInput.trim()) ||
                  isSending ||
                  isUploading
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Mengupload...' : isSending ? 'Mengirim...' : 'Kirim Foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm mx-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">😊 Pilih Emoji</h3>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Emoji Categories */}
            <div className="space-y-3">
              {/* Smileys */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Ekspresi</p>
                <div className="flex flex-wrap gap-2">
                  {['😊', '😄', '😁', '🤗', '😍', '🥰', '😎', '🤩', '😇', '🙂', '😉', '😋'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setMessageInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gestures */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Gestur</p>
                <div className="flex flex-wrap gap-2">
                  {['👍', '👏', '🙏', '🤝', '💪', '✌️', '👌', '🤞', '👋', '🙌', '💯', '⭐'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setMessageInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Objects - Cars & Business */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Mobil & Bisnis</p>
                <div className="flex flex-wrap gap-2">
                  {['🚗', '🚙', '🚕', '🏎️', '🚘', '💰', '💵', '💳', '📱', '📞', '✅', '❌'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setMessageInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Celebration */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Perayaan</p>
                <div className="flex flex-wrap gap-2">
                  {['🎉', '🎊', '🥳', '🎁', '🏆', '🔥', '💥', '✨', '🌟', '❤️', '💖', '💝'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setMessageInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">📄 Kirim Dokumen</h3>

            {/* Mode Tabs */}
            <div className="flex mb-4 border-b border-gray-200">
              <button
                onClick={() => setDocumentUploadMode('file')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  documentUploadMode === 'file'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 Upload File
              </button>
              <button
                onClick={() => setDocumentUploadMode('url')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  documentUploadMode === 'url'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔗 Paste URL
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload Mode */}
              {documentUploadMode === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Dokumen *
                  </label>
                  <div
                    onClick={() => documentInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                  >
                    {selectedDocument ? (
                      <div className="space-y-2">
                        <div className="text-4xl">
                          {selectedDocument.name.endsWith('.pdf') ? '📕' :
                           selectedDocument.name.match(/\.docx?$/) ? '📘' :
                           selectedDocument.name.match(/\.xlsx?$/) ? '📗' :
                           selectedDocument.name.match(/\.pptx?$/) ? '📙' : '📄'}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate px-2">{selectedDocument.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedDocument.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDocument(null);
                            if (documentInputRef.current) {
                              documentInputRef.current.value = '';
                            }
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-4xl">📤</div>
                        <p className="text-sm text-gray-600">
                          Klik untuk memilih dokumen
                        </p>
                        <p className="text-xs text-gray-400">
                          PDF, Word, Excel, PowerPoint (maks 25MB)
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Bisa dari smartphone, laptop, atau penyimpanan lokal
                  </p>
                </div>
              )}

              {/* URL Mode */}
              {documentUploadMode === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Dokumen *
                  </label>
                  <input
                    type="url"
                    value={documentUrlInput}
                    onChange={(e) => setDocumentUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/file/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste URL dokumen dari Google Drive, Dropbox, atau website lain
                  </p>
                </div>
              )}

              {/* Caption - shared for both modes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keterangan (opsional)
                </label>
                <input
                  type="text"
                  value={documentCaptionInput}
                  onChange={(e) => setDocumentCaptionInput(e.target.value)}
                  placeholder="Keterangan dokumen..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Progress indicator */}
            {(isUploadingDocument || isSending) && uploadProgress && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm text-blue-700">{uploadProgress}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDocumentModal(false);
                  setDocumentUrlInput('');
                  setDocumentCaptionInput('');
                  setSelectedDocument(null);
                  setUploadProgress('');
                  if (documentInputRef.current) {
                    documentInputRef.current.value = '';
                  }
                }}
                disabled={isUploadingDocument || isSending}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSendDocument}
                disabled={
                  (documentUploadMode === 'file' && !selectedDocument) ||
                  (documentUploadMode === 'url' && !documentUrlInput.trim()) ||
                  isSending ||
                  isUploadingDocument
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingDocument ? 'Mengupload...' : isSending ? 'Mengirim...' : 'Kirim Dokumen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
