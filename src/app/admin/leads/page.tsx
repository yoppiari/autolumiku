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
      try {
        const response = await fetch(`/api/admin/leads?status=${statusFilter === 'all' ? '' : statusFilter.toUpperCase()}&source=${sourceFilter === 'all' ? '' : sourceFilter}&search=${searchTerm}`);
        const result = await response.json();

        if (result.success) {
          const normalizedLeads = result.data.leads.map((l: any) => ({
            id: l.id,
            customerName: l.name,
            phone: l.phone,
            whatsappNumber: l.whatsappNumber || l.phone,
            email: l.email,
            vehicleInterest: l.interestedIn,
            budget: l.budgetRange,
            urgency: l.priority?.toLowerCase() || 'medium',
            status: l.status?.toLowerCase() || 'new',
            source: l.source?.toLowerCase() || 'whatsapp',
            message: l.message,
            tenantId: l.tenantId,
            tenantName: l.tenant?.name || 'Showroom',
            createdAt: l.createdAt,
          }));

          setLeads(normalizedLeads);

          if (result.data.stats) {
            setStats({
              total: result.data.stats.total,
              new: result.data.stats.new,
              contacted: result.data.stats.contacted,
              interested: result.data.stats.interested,
              converted: result.data.stats.converted,
              conversionRate: result.data.stats.conversionRate,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeadsData();
  }, [statusFilter, sourceFilter, searchTerm]);

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
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus.toUpperCase() })
      });

      const result = await response.json();
      if (result.success) {
        setLeads(prev => prev.map(lead =>
          lead.id === leadId ? { ...lead, status: newStatus as any } : lead
        ));
      }
    } catch (error) {
      console.error('Failed to update lead status:', error);
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
    <div className="p-4 sm:p-6 space-y-6">

      {/* Actions Bar (Title handled by Admin Layout) */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-4">
        <div className="flex space-x-2 w-full sm:w-auto">
          <Link
            href="/admin/leads/whatsapp-settings"
            className="w-full sm:w-auto text-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
          >
            ⚙️ WhatsApp Settings
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Total Leads</h3>
          <div className="text-xl sm:text-3xl font-bold text-blue-600">{stats.total}</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Lead Baru</h3>
          <div className="text-xl sm:text-3xl font-bold text-blue-600">{stats.new}</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Tertarik</h3>
          <div className="text-xl sm:text-3xl font-bold text-purple-600">{stats.interested}</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xs sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Konversi</h3>
          <div className="text-xl sm:text-3xl font-bold text-green-600">{stats.converted}</div>
          <div className="hidden sm:block text-sm text-gray-600 mt-1">{stats.conversionRate}% rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Leads</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama/HP..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex gap-4">
            <div className="sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">Semua</option>
                <option value="new">Baru</option>
                <option value="contacted">Dihubungi</option>
                <option value="interested">Tertarik</option>
                <option value="not_interested">Tidak</option>
                <option value="converted">Konversi</option>
              </select>
            </div>

            <div className="sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sumber</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">Semua</option>
                <option value="whatsapp">WA</option>
                <option value="website">Web</option>
                <option value="phone">Telp</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Settings Summary - Mobile Optimized */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
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
            <div key={setting.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 text-sm sm:text-base">{setting.tenantName}</h3>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${setting.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {setting.isActive ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                <p><strong>Nomor:</strong> {setting.phoneNumber}</p>
                <p><strong>Auto Reply:</strong> {setting.autoReply ? 'Ya' : 'Tidak'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leads List - Mobile: Cards, Desktop: Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Mobile View */}
        <div className="block sm:hidden divide-y divide-gray-200">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{lead.customerName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{getSourceIcon(lead.source)} {lead.phone}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(lead.urgency)}`}>
                    {lead.urgency.toUpperCase()}
                  </span>
                  <div className="text-xs text-gray-400">{formatDate(lead.createdAt).split(',')[0]}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <div>Interested: <span className="font-medium text-gray-800">{lead.vehicleInterest || '-'}</span></div>
                <div>Budget: <span className="font-medium text-gray-800">{lead.budget || '-'}</span></div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                  className={`text-xs font-medium rounded-full border-0 py-1 pl-2 pr-6 ${getStatusBadgeColor(lead.status)}`}
                >
                  <option value="new">BARU</option>
                  <option value="contacted">DIHUBUNGI</option>
                  <option value="interested">TERTARIK</option>
                  <option value="not_interested">TIDAK</option>
                  <option value="converted">KONVERSI</option>
                </select>

                <div className="flex space-x-3">
                  <button
                    onClick={() => window.open(`https://wa.me/${lead.whatsappNumber.replace(/[^\d]/g, '')}`, '_blank')}
                    className="text-green-600 bg-green-50 p-2 rounded-full hover:bg-green-100"
                    title="Kirim WhatsApp"
                  >
                    📱
                  </button>
                  <button
                    onClick={() => console.log('View details:', lead.id)}
                    className="text-blue-600 bg-blue-50 p-2 rounded-full hover:bg-blue-100"
                    title="Lihat Detail"
                  >
                    👁️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block overflow-x-auto">
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