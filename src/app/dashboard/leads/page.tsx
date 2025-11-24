/**
 * Leads Dashboard - Simple WhatsApp Lead Management
 * Focus on tracking leads from WhatsApp integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lead {
  id: string;
  customerName: string;
  phone: string;
  whatsappNumber: string;
  email?: string;
  vehicleInterest?: string;
  budget?: string;
  urgency: 'high' | 'medium' | 'low';
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'converted';
  source: 'whatsapp' | 'website' | 'phone';
  message: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  lastContactAt?: string;
  assignedTo?: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  converted: number;
  conversionRate: number;
}

interface WhatsAppSettings {
  id: string;
  tenantId: string;
  tenantName: string;
  phoneNumber: string;
  isActive: boolean;
  defaultMessage: string;
  autoReply: boolean;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    total: 0,
    new: 0,
    contacted: 0,
    interested: 0,
    converted: 0,
    conversionRate: 0,
  });
  const [whatsappSettings, setWhatsAppSettings] = useState<WhatsAppSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Mock data for development
  useEffect(() => {
    const loadLeadsData = async () => {
      setIsLoading(true);
      
      // Mock leads data from WhatsApp integration
      const mockLeads: Lead[] = [
        {
          id: '1',
          customerName: 'Budi Santoso',
          phone: '+62-812-3456-7890',
          whatsappNumber: '+62-812-3456-7890',
          email: 'budi.santoso@email.com',
          vehicleInterest: 'Toyota Avanza 2023',
          budget: '200-250 juta',
          urgency: 'high',
          status: 'new',
          source: 'whatsapp',
          message: 'Halo, saya tertarik dengan Toyota Avanza 2023 yang diiklankan. Apakah masih tersedia?',
          tenantId: 'tenant-1',
          tenantName: 'Showroom Jakarta',
          createdAt: '2025-11-23T10:30:00Z',
        },
        {
          id: '2',
          customerName: 'Siti Nurhaliza',
          phone: '+62-813-4567-8901',
          whatsappNumber: '+62-813-4567-8901',
          vehicleInterest: 'Honda CR-V 2023',
          budget: '300-350 juta',
          urgency: 'medium',
          status: 'contacted',
          source: 'whatsapp',
          message: 'Minta info lebih lanjut tentang Honda CR-V, warna putih',
          tenantId: 'tenant-1',
          tenantName: 'Showroom Jakarta',
          createdAt: '2025-11-23T09:15:00Z',
          lastContactAt: '2025-11-23T11:00:00Z',
          assignedTo: 'Sales Team A',
        },
        {
          id: '3',
          customerName: 'Ahmad Pratama',
          phone: '+62-814-5678-9012',
          whatsappNumber: '+62-814-5678-9012',
          vehicleInterest: 'Mitsubishi Xpander 2024',
          budget: '250-300 juta',
          urgency: 'high',
          status: 'interested',
          source: 'website',
          message: 'Submit form dari website, tertarik dengan Xpander',
          tenantId: 'tenant-2',
          tenantName: 'Dealer Mobil',
          createdAt: '2025-11-22T16:20:00Z',
          lastContactAt: '2025-11-23T08:30:00Z',
          assignedTo: 'Sales Team B',
        },
        {
          id: '4',
          customerName: 'Rina Wijaya',
          phone: '+62-815-6789-0123',
          whatsappNumber: '+62-815-6789-0123',
          vehicleInterest: 'Suzuki Ertiga 2023',
          budget: '180-220 juta',
          urgency: 'low',
          status: 'converted',
          source: 'whatsapp',
          message: 'Sudah deal dan melakukan pembayaran untuk Suzuki Ertiga',
          tenantId: 'tenant-1',
          tenantName: 'Showroom Jakarta',
          createdAt: '2025-11-20T14:45:00Z',
          lastContactAt: '2025-11-22T10:15:00Z',
          assignedTo: 'Sales Team A',
        },
      ];

      // Mock WhatsApp settings
      const mockWhatsAppSettings: WhatsAppSettings[] = [
        {
          id: '1',
          tenantId: 'tenant-1',
          tenantName: 'Showroom Jakarta',
          phoneNumber: '+62-21-5550-1234',
          isActive: true,
          defaultMessage: 'Halo! Terima kasih telah menghubungi Showroom Jakarta. Ada yang bisa kami bantu?',
          autoReply: true,
          workingHours: {
            start: '08:00',
            end: '17:00',
            timezone: 'Asia/Jakarta',
          },
        },
        {
          id: '2',
          tenantId: 'tenant-2',
          tenantName: 'Dealer Mobil',
          phoneNumber: '+62-22-6666-5678',
          isActive: true,
          defaultMessage: 'Selamat datang di Dealer Mobil! Kami siap membantu Anda.',
          autoReply: false,
          workingHours: {
            start: '09:00',
            end: '18:00',
            timezone: 'Asia/Jakarta',
          },
        },
      ];

      // Calculate stats
      const leadStats = mockLeads.reduce((acc, lead) => {
        acc.total++;
        acc[lead.status]++;
        
        return acc;
      }, { total: 0, new: 0, contacted: 0, interested: 0, converted: 0, conversionRate: 0 });

      // Calculate conversion rate
      if (leadStats.total > 0) {
        leadStats.conversionRate = Math.round((leadStats.converted / leadStats.total) * 100 * 10) / 10;
      }

      setLeads(mockLeads);
      setStats(leadStats);
      setWhatsAppSettings(mockWhatsAppSettings);
      setIsLoading(false);
    };

    loadLeadsData();
  }, []);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone.includes(searchTerm) ||
                         lead.vehicleInterest?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.tenantName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'interested': return 'bg-purple-100 text-purple-800';
      case 'not_interested': return 'bg-gray-100 text-gray-800';
      case 'converted': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'whatsapp': return '📱';
      case 'website': return '🌐';
      case 'phone': return '📞';
      default: return '📝';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    // Mock API call
    console.log('Updating lead status:', leadId, newStatus);
    
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, status: newStatus as any } : lead
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Leads</h1>
          <p className="text-gray-600 mt-1">Kelola leads dari WhatsApp dan website</p>
        </div>

        <div className="flex space-x-4">
          <Link
            href="/admin/leads/whatsapp-settings"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ⚙️ WhatsApp Settings
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Leads</h3>
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Lead Baru</h3>
          <div className="text-3xl font-bold text-blue-600">{stats.new}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tertarik</h3>
          <div className="text-3xl font-bold text-purple-600">{stats.interested}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Konversi</h3>
          <div className="text-3xl font-bold text-green-600">{stats.converted}</div>
          <div className="text-sm text-gray-600 mt-1">{stats.conversionRate}% rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Leads</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama, telepon, atau kendaraan..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="new">Baru</option>
              <option value="contacted">Dihubungi</option>
              <option value="interested">Tertarik</option>
              <option value="not_interested">Tidak Tertarik</option>
              <option value="converted">Konversi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sumber</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Sumber</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="phone">Telepon</option>
            </select>
          </div>
        </div>
      </div>

      {/* WhatsApp Settings Summary */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">WhatsApp Settings</h2>
          <Link
            href="/admin/leads/whatsapp-settings"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Kelola Settings →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {whatsappSettings.map((setting) => (
            <div key={setting.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{setting.tenantName}</h3>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  setting.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {setting.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <p><strong>Nomor:</strong> {setting.phoneNumber}</p>
                <p><strong>Auto Reply:</strong> {setting.autoReply ? 'Aktif' : 'Tidak Aktif'}</p>
                <p><strong>Jam Kerja:</strong> {setting.workingHours.start} - {setting.workingHours.end}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kendaraan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Urgensi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sumber
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lead.customerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getSourceIcon(lead.source)} {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="text-xs text-gray-400">
                          {lead.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.vehicleInterest || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.budget || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(lead.urgency)}`}>
                      {lead.urgency.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getSourceIcon(lead.source)} {lead.source.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`text-xs font-medium rounded-full border-0 bg-transparent ${getStatusBadgeColor(lead.status)}`}
                    >
                      <option value="new">BARU</option>
                      <option value="contacted">DIHUBUNGI</option>
                      <option value="interested">TERTARIK</option>
                      <option value="not_interested">TIDAK TERTARIK</option>
                      <option value="converted">KONVERSI</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.tenantName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => window.open(`https://wa.me/${lead.whatsappNumber.replace(/[^\d]/g, '')}`, '_blank')}
                        className="text-green-600 hover:text-green-900"
                        title="Kirim WhatsApp"
                      >
                        📱
                      </button>
                      <button
                        onClick={() => console.log('View details:', lead.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Lihat Detail"
                      >
                        👁️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">Tidak ada leads yang ditemukan</div>
          <p className="text-gray-400 mt-2">Coba ubah filter atau tunggu leads baru dari WhatsApp</p>
        </div>
      )}
    </div>
  );
}