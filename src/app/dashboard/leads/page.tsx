/**
 * Leads Dashboard - Simple WhatsApp Lead Management
 * Focus on tracking leads from WhatsApp integration
 * 
 * ACCESS: ADMIN+ only (roleLevel >= 90)
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { withRoleProtection } from '@/lib/auth/withRoleProtection';
import { ROLE_LEVELS } from '@/lib/rbac';

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

function LeadsDashboard() {
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

    // Real-time: Poll every 15 seconds
    const intervalId = setInterval(() => {
      // Only refresh if not searching (avoid disruption)
      if (searchTerm === '' && statusFilter === 'all' && sourceFilter === 'all') {
        loadLeadsData();
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [searchTerm, statusFilter, sourceFilter]);

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
      case 'new': return 'bg-blue-900/40 text-blue-300 border border-blue-800/50';
      case 'contacted': return 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/50';
      case 'interested': return 'bg-purple-900/40 text-purple-300 border border-purple-800/50';
      case 'not_interested': return 'bg-gray-700 text-gray-300 border border-gray-600';
      case 'converted': return 'bg-green-900/40 text-green-300 border border-green-800/50';
      default: return 'bg-gray-700 text-gray-300 border border-gray-600';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-900/40 text-red-300 border border-red-800/50';
      case 'medium': return 'bg-orange-900/40 text-orange-300 border border-orange-800/50';
      case 'low': return 'bg-green-900/40 text-green-300 border border-green-800/50';
      default: return 'bg-gray-700 text-gray-300 border border-gray-600';
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
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 h-auto md:h-[calc(100vh-80px)] flex flex-col overflow-y-auto md:overflow-hidden bg-[#1a1a1a]">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Manajemen Leads</h1>
          <p className="text-xs text-gray-400">Kelola leads dari WhatsApp dan website</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Live Updates Indicator - Conditional */}
          {whatsappSettings.length > 0 && whatsappSettings[0].isActive ? (
            <div title="WhatsApp Bot Aktif - Data Realtime" className="flex items-center gap-1.5 px-2 py-1 bg-green-900/40 text-green-400 rounded-full border border-green-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] font-medium">Live</span>
            </div>
          ) : (
            <div title="WhatsApp Bot Tidak Aktif - Klik WhatsApp Settings untuk mengaktifkan" className="flex items-center gap-1.5 px-2 py-1 bg-red-900/40 text-red-400 rounded-full border border-red-800">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-medium">Off</span>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-sm"
            title="Refresh Data"
          >
            🔄
          </button>


        </div>
      </div>   {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-[#2a2a2a] p-4 rounded-xl shadow-sm border border-[#3a3a3a] flex flex-col justify-between h-24">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Leads</h3>
          <div className="text-3xl font-bold text-blue-500 mt-1">{stats.total}</div>
        </div>

        <div className="bg-[#2a2a2a] p-4 rounded-xl shadow-sm border border-[#3a3a3a] flex flex-col justify-between h-24">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Baru</h3>
          <div className="text-3xl font-bold text-blue-400 mt-1">{stats.new}</div>
        </div>

        <div className="bg-[#2a2a2a] p-4 rounded-xl shadow-sm border border-[#3a3a3a] flex flex-col justify-between h-24">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tertarik</h3>
          <div className="text-3xl font-bold text-purple-500 mt-1">{stats.interested}</div>
        </div>

        <div className="bg-[#2a2a2a] p-4 rounded-xl shadow-sm border border-[#3a3a3a] flex flex-col justify-between h-24">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Konversi</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-3xl font-bold text-green-500">{stats.converted}</div>
            <div className="text-xs font-medium text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded-full">{stats.conversionRate}%</div>
          </div>
        </div>
      </div>

      {/* Filters & WhatsApp Settings - Combined Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 flex-shrink-0">
        {/* Filters */}
        <div className="col-span-2 bg-[#2a2a2a] p-3 rounded-lg shadow-sm border border-[#3a3a3a]">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Cari Leads</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nama, telepon, kendaraan..."
                className="w-full px-2 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Sumber</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-2 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
        <div className="bg-[#2a2a2a] p-3 rounded-lg shadow-sm border border-[#3a3a3a]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-gray-300">WhatsApp</h2>
            <Link
              href="/dashboard/leads/whatsapp-settings"
              className="text-gray-400 hover:text-blue-400 transition-colors"
              title="Settings"
            >
              ⚙️
            </Link>
          </div>
          {whatsappSettings.map((setting) => (
            <div key={setting.id} className="text-[11px] text-gray-400">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${setting.isActive ? 'bg-green-500' : 'bg-gray-600'}`}></span>
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
      <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          {/* Desktop Table */}
          <table className="hidden md:table min-w-full divide-y divide-[#3a3a3a]">
            <thead className="bg-[#333] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Kendaraan
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Budget
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Urgensi
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Sumber
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Tanggal
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#2a2a2a] divide-y divide-[#3a3a3a]">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#333] transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>
                      <div className="text-xs font-medium text-gray-200">
                        {lead.customerName}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {getSourceIcon(lead.source)} {lead.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-200">
                    {lead.vehicleInterest || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-200">
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
                      <option value="new" className="text-black">BARU</option>
                      <option value="contacted" className="text-black">DIHUBUNGI</option>
                      <option value="interested" className="text-black">TERTARIK</option>
                      <option value="not_interested" className="text-black">TIDAK TERTARIK</option>
                      <option value="converted" className="text-black">KONVERSI</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-500">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => window.open(`https://wa.me/${lead.whatsappNumber.replace(/[^\d]/g, '')}`, '_blank')}
                        className="text-green-500 hover:text-green-400 text-sm"
                        title="Kirim WhatsApp"
                      >
                        📱
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2 p-2">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-[#2a2a2a] p-3 rounded-lg border border-[#3a3a3a] shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">{lead.customerName}</h3>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {getSourceIcon(lead.source)} {lead.phone}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getUrgencyColor(lead.urgency)}`}>
                    {lead.urgency}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-[#333] p-1.5 rounded">
                    <span className="block text-[10px] text-gray-500">Minat</span>
                    <span className="font-medium text-gray-300">{lead.vehicleInterest || '-'}</span>
                  </div>
                  <div className="bg-[#333] p-1.5 rounded">
                    <span className="block text-[10px] text-gray-500">Budget</span>
                    <span className="font-medium text-gray-300">{lead.budget || '-'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-[#444] pt-2">
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    className={`text-xs font-medium rounded border-0 bg-transparent px-1 py-0.5 ${getStatusBadgeColor(lead.status)}`}
                  >
                    <option value="new" className="text-black">BARU</option>
                    <option value="contacted" className="text-black">DIHUBUNGI</option>
                    <option value="interested" className="text-black">TERTARIK</option>
                    <option value="not_interested" className="text-black">TIDAK TERTARIK</option>
                    <option value="converted" className="text-black">KONVERSI</option>
                  </select>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(`https://wa.me/${lead.whatsappNumber.replace(/[^\d]/g, '')}`, '_blank')}
                      className="p-1.5 bg-green-900/40 text-green-400 border border-green-800 rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      📱 Chat
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {filteredLeads.length === 0 && (
          <div className="text-center py-6">
            <div className="text-gray-500 text-sm">Tidak ada leads yang ditemukan</div>
            <p className="text-gray-400 text-xs mt-1">Coba ubah filter atau tunggu leads baru</p>
          </div>
        )}
      </div>
    </div >
  );
}

// Protect this page - ADMIN+ only
export default withRoleProtection(LeadsDashboard, ROLE_LEVELS.ADMIN);