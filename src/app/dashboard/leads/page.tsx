/**
 * Lead Management Page
 * Epic 6: Lead Capture & Engagement
 *
 * Stories covered:
 * - 6.1: Lead Capture from Catalog
 * - 6.2: Lead Scoring & Prioritization
 * - 6.3: WhatsApp Integration
 * - 6.4: Lead Activity Tracking
 * - 6.5: Task Management
 * - 6.6: Communication History
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string; // WEBSITE, WHATSAPP, REFERRAL, PHONE, WALK_IN
  status: string; // NEW, CONTACTED, QUALIFIED, NEGOTIATION, WON, LOST
  score: number; // 0-100
  vehicleId?: string;
  vehicleName?: string;
  assignedToId?: string;
  assignedToName?: string;
  notes?: string;
  createdAt: string;
  lastContactedAt?: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, new, contacted, qualified, won, lost
  const [sortBy, setSortBy] = useState('score'); // score, date, status

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('accessToken');

      if (!user.tenantId) return;

      const response = await fetch(`/api/v1/tenants/${user.tenantId}/leads`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setLeads(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      NEW: 'bg-blue-100 text-blue-800',
      CONTACTED: 'bg-yellow-100 text-yellow-800',
      QUALIFIED: 'bg-purple-100 text-purple-800',
      NEGOTIATION: 'bg-orange-100 text-orange-800',
      WON: 'bg-green-100 text-green-800',
      LOST: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Hot' };
    if (score >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Warm' };
    return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cold' };
  };

  const getSourceIcon = (source: string) => {
    const icons = {
      WEBSITE: '🌐',
      WHATSAPP: '💬',
      REFERRAL: '👥',
      PHONE: '📞',
      WALK_IN: '🚶',
    };
    return icons[source as keyof typeof icons] || '📧';
  };

  const filteredLeads = leads
    .filter((lead) => {
      if (filter === 'all') return true;
      return lead.status.toLowerCase() === filter.toLowerCase();
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'NEW').length,
    contacted: leads.filter((l) => l.status === 'CONTACTED').length,
    qualified: leads.filter((l) => l.status === 'QUALIFIED').length,
    won: leads.filter((l) => l.status === 'WON').length,
    hot: leads.filter((l) => l.score >= 80).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">Track and convert customer inquiries</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span>WhatsApp Broadcast</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('all')}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Leads</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('new')}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">New</p>
            <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('contacted')}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Contacted</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.contacted}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('qualified')}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Qualified</p>
            <p className="text-2xl font-bold text-purple-600">{stats.qualified}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('won')}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Won</p>
            <p className="text-2xl font-bold text-green-600">{stats.won}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Hot Leads</p>
            <p className="text-2xl font-bold text-red-600">{stats.hot} 🔥</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {['all', 'new', 'contacted', 'qualified', 'won', 'lost'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="score">Lead Score</option>
            <option value="date">Date Created</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 mb-2">No leads found</p>
              <p className="text-sm text-gray-500">Leads will appear here when customers inquire about vehicles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => {
                const scoreBadge = getScoreBadge(lead.score);
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {lead.firstName[0]}{lead.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {lead.firstName} {lead.lastName}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                            {lead.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${scoreBadge.bg} ${scoreBadge.text}`}>
                            {scoreBadge.label} {lead.score}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>{lead.email}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{lead.phone}</span>
                          </span>
                          <span>{getSourceIcon(lead.source)} {lead.source}</span>
                        </div>
                        {lead.vehicleName && (
                          <p className="text-sm text-gray-500 mt-1">
                            Interested in: <span className="font-medium text-gray-700">{lead.vehicleName}</span>
                          </p>
                        )}
                        {lead.assignedToName && (
                          <p className="text-sm text-gray-500 mt-1">
                            Assigned to: <span className="font-medium text-gray-700">{lead.assignedToName}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="WhatsApp"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
