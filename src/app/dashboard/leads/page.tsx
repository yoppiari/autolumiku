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

  // Load real data from API
  useEffect(() => {
    const loadLeadsData = async () => {
      setIsLoading(true);

      try {
        // Get tenantId from localStorage
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.error('No user found in localStorage');
          setIsLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        // Fetch leads and stats from API
        const [leadsResponse, whatsappResponse] = await Promise.all([
          fetch(`/api/v1/leads?tenantId=${tenantId}`),
          fetch(`/api/v1/whatsapp-settings?tenantId=${tenantId}`),
        ]);

        if (leadsResponse.ok) {
          const leadsData = await leadsResponse.json();
          if (leadsData.success) {
            // Map API response to Lead interface
            const fetchedLeads: Lead[] = (leadsData.data.leads || []).map((lead: any) => ({
              id: lead.id,
              customerName: lead.customerName || 'Unknown',
              phone: lead.phoneNumber || '',
              whatsappNumber: lead.whatsappNumber || lead.phoneNumber || '',
              email: lead.email,
              vehicleInterest: lead.vehicleName || 'N/A',
              budget: lead.budget || '',
              urgency: (lead.priority?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
              status: lead.status?.toLowerCase() || 'new',
              source: lead.source?.toLowerCase() || 'whatsapp',
              message: lead.notes || lead.message || '',
              tenantId: lead.tenantId,
              tenantName: parsedUser.tenantName || 'Showroom',
              createdAt: lead.createdAt,
              lastContactAt: lead.lastContactedAt,
              assignedTo: lead.assignedTo,
            }));

            setLeads(fetchedLeads);

            // Update stats from API data
            if (leadsData.data.stats) {
              setStats({
                total: leadsData.data.stats.total || 0,
                new: leadsData.data.stats.byStatus?.NEW || 0,
                contacted: leadsData.data.stats.byStatus?.CONTACTED || 0,
                interested: leadsData.data.stats.byStatus?.QUALIFIED || 0,
                converted: leadsData.data.stats.byStatus?.CONVERTED || 0,
                conversionRate: leadsData.data.stats.byStatus?.CONVERTED
                  ? Math.round((leadsData.data.stats.byStatus.CONVERTED / leadsData.data.stats.total) * 100 * 10) / 10
                  : 0,
              });
            }
          }
        }

        if (whatsappResponse.ok) {
          const whatsappData = await whatsappResponse.json();
          if (whatsappData.success && whatsappData.data) {
            const settings: WhatsAppSettings = {
              id: whatsappData.data.id || '1',
              tenantId: whatsappData.data.tenantId,
              tenantName: parsedUser.tenantName || 'Showroom',
              phoneNumber: whatsappData.data.phoneNumber || '',
              isActive: whatsappData.data.isActive !== false,
              defaultMessage: whatsappData.data.defaultMessage || 'Halo! Ada yang bisa kami bantu?',
              autoReply: whatsappData.data.autoReply || false,
              workingHours: whatsappData.data.workingHours || {
                start: '08:00',
                end: '17:00',
                timezone: 'Asia/Jakarta',
              },
            };
            setWhatsAppSettings([settings]);
          }
        }
      } catch (error) {
        console.error('Error loading leads data:', error);
      } finally {
        setIsLoading(false);
      }
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
    try {
      // Real API call to update lead status
      const response = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus.toUpperCase() }),
      });

      if (response.ok) {
        // Update local state on success
        setLeads(prev => prev.map(lead =>
          lead.id === leadId ? { ...lead, status: newStatus as any } : lead
        ));
      } else {
        console.error('Failed to update lead status');
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manajemen Leads</h1>
          <p className="text-xs text-gray-600">Kelola leads dari WhatsApp dan website</p>
        </div>

        <Link
          href="/dashboard/leads/whatsapp-settings"
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          ⚙️ WhatsApp Settings
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 flex-shrink-0">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600">Total Leads</h3>
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600">Lead Baru</h3>
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600">Tertarik</h3>
          <div className="text-2xl font-bold text-purple-600">{stats.interested}</div>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600">Konversi</h3>
          <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
          <div className="text-[10px] text-gray-500">{stats.conversionRate}% rate</div>
        </div>
      </div>

      {/* Filters & WhatsApp Settings - Combined Row */}
      <div className="grid grid-cols-3 gap-2 flex-shrink-0">
        {/* Filters */}
        <div className="col-span-2 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Cari Leads</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nama, telepon, kendaraan..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua</option>
                <option value="new">Baru</option>
                <option value="contacted">Dihubungi</option>
                <option value="interested">Tertarik</option>
                <option value="not_interested">Tidak Tertarik</option>
                <option value="converted">Konversi</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Sumber</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Website</option>
                <option value="phone">Telepon</option>
              </select>
            </div>
          </div>
        </div>

        {/* WhatsApp Settings Summary - Compact */}
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-gray-700">WhatsApp</h2>
            <Link href="/dashboard/leads/whatsapp-settings" className="text-[10px] text-blue-600 hover:text-blue-800">
              Settings →
            </Link>
          </div>
          {whatsappSettings.map((setting) => (
            <div key={setting.id} className="text-[11px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${setting.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span className="font-medium">{setting.phoneNumber || 'Belum setup'}</span>
              </div>
              <div className="text-[10px] text-gray-500">
                {setting.workingHours.start} - {setting.workingHours.end}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leads Table - Scrollable */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Kendaraan
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Budget
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Urgensi
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Sumber
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Tanggal
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {lead.customerName}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {getSourceIcon(lead.source)} {lead.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                    {lead.vehicleInterest || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                    {lead.budget || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getUrgencyColor(lead.urgency)}`}>
                      {lead.urgency.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                    {getSourceIcon(lead.source)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`text-[10px] font-medium rounded border-0 bg-transparent px-1 py-0.5 ${getStatusBadgeColor(lead.status)}`}
                    >
                      <option value="new">BARU</option>
                      <option value="contacted">DIHUBUNGI</option>
                      <option value="interested">TERTARIK</option>
                      <option value="not_interested">TIDAK TERTARIK</option>
                      <option value="converted">KONVERSI</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-500">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => window.open(`https://wa.me/${lead.whatsappNumber.replace(/[^\d]/g, '')}`, '_blank')}
                        className="text-green-600 hover:text-green-900 text-sm"
                        title="Kirim WhatsApp"
                      >
                        📱
                      </button>
                      <button
                        onClick={() => console.log('View details:', lead.id)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
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
        {filteredLeads.length === 0 && (
          <div className="text-center py-6">
            <div className="text-gray-500 text-sm">Tidak ada leads yang ditemukan</div>
            <p className="text-gray-400 text-xs mt-1">Coba ubah filter atau tunggu leads baru</p>
          </div>
        )}
      </div>
    </div>
  );
}