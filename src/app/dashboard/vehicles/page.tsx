'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createVehicleSlug } from '@/lib/utils';
import { api } from '@/lib/api-client';
import VehicleImageCarousel from '@/components/ui/VehicleImageCarousel';
import { ROLE_LEVELS } from '@/lib/rbac';

type VehicleStatus = 'DRAFT' | 'AVAILABLE' | 'BOOKED' | 'SOLD' | 'DELETED';
type ViewMode = 'grid' | 'list';

interface Vehicle {
  id: string;
  displayId?: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  price: number;
  mileage?: number;
  color?: string;
  licensePlate?: string;
  status: VehicleStatus;
  transmissionType?: string;
  fuelType?: string;
  engineCapacity?: number;
  photos: { thumbnailUrl: string; originalUrl: string }[];
  description?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Access guard
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // const roleLevel = parsedUser.roleLevel || ROLE_LEVELS.SALES; 
    }
  }, [router]);

  useEffect(() => {
    if (!accessDenied) {
      fetchVehicles();
    }
  }, [accessDenied]);

  useEffect(() => {
    applyFilters();
  }, [vehicles, statusFilter, searchQuery, sortBy]);

  // Auto-fix vehicle IDs
  useEffect(() => {
    const fixVehicleIds = async () => {
      if (vehicles.length === 0) return;

      const activeVehicles = vehicles.filter(v => v.status !== 'DELETED');
      if (activeVehicles.length === 0) return;

      const sorted = [...activeVehicles].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const firstVehicle = sorted[0];
      if (!firstVehicle?.displayId) return;

      const match = firstVehicle.displayId.match(/-(\d+)$/);
      if (!match) return;

      const firstSeq = parseInt(match[1], 10);
      if (firstSeq <= 1) return;

      setResequenceStatus('🔄 Memperbaiki urutan ID kendaraan...');
      const slug = detectSlugFromDomain();
      if (!slug) return;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/v1/vehicles?action=resequence-ids&slug=${slug}`, {
          headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
        });

        const result = await response.json();
        if (response.ok && result.success) {
          setResequenceStatus('✅ ID berhasil diperbaiki! Memuat ulang...');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          setResequenceStatus(null);
        }
      } catch (err) {
        setResequenceStatus(null);
      }
    };
    fixVehicleIds();
  }, [vehicles]);

  const detectSlugFromDomain = (): string | null => {
    if (typeof window === 'undefined') return null;
    const hostname = window.location.hostname;
    const domainMap: Record<string, string> = {
      'primamobil.id': 'primamobil-id',
      'www.primamobil.id': 'primamobil-id',
      'localhost': 'primamobil-id',
    };
    return domainMap[hostname] || null;
  };

  const [resequenceStatus, setResequenceStatus] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      setError(null);
      const userStr = localStorage.getItem('user');
      const tenantId = userStr ? JSON.parse(userStr).tenantId : null;
      const slug = detectSlugFromDomain();

      let url = `/api/v1/vehicles?_t=${Date.now()}`;
      if (slug) url = `/api/v1/vehicles?slug=${slug}`;
      else if (tenantId) url = `/api/v1/vehicles?tenantId=${tenantId}`;
      else {
        setError('Tidak dapat mendeteksi tenant. Silakan login ulang.');
        setLoading(false);
        return;
      }

      const result = await api.get(url);
      if (result.success) {
        setVehicles(result.data || []);
      } else {
        setError(result.error || 'Gagal memuat data kendaraan');
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vehicles];
    if (statusFilter !== 'DELETED') {
      filtered = filtered.filter(v => v.status !== 'DELETED');
    }
    if (statusFilter !== 'ALL' && statusFilter !== 'DELETED') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.year.toString().includes(query) ||
        (v.variant && v.variant.toLowerCase().includes(query))
      );
    }
    filtered.sort((a, b) => {
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.price - a.price;
    });
    setFilteredVehicles(filtered);
  };

  const formatPrice = (cents: number) => {
    const rupiah = cents / 1000000;
    return `Rp ${rupiah.toFixed(0)} jt`;
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-[#333] text-gray-300 border-[#444]';
      case 'AVAILABLE': return 'bg-green-900/40 text-green-400 border-green-800 animate-status-ready';
      case 'BOOKED': return 'bg-amber-900/40 text-amber-400 border-amber-800 animate-status-booking';
      case 'SOLD': return 'bg-rose-900/40 text-rose-400 border-rose-800 font-bold animate-status-sold';
      case 'DELETED': return 'bg-red-900/20 text-red-400 border-red-900';
    }
  };

  const getStatusLabel = (status: VehicleStatus) => {
    switch (status) {
      case 'DRAFT': return 'Draft';
      case 'AVAILABLE': return 'Tersedia';
      case 'BOOKED': return 'Booking';
      case 'SOLD': return 'Terjual';
      case 'DELETED': return 'Deleted';
    }
  };

  const activeVehicles = vehicles.filter(v => v.status !== 'DELETED');
  const stats = {
    total: activeVehicles.length,
    draft: activeVehicles.filter(v => v.status === 'DRAFT').length,
    available: activeVehicles.filter(v => v.status === 'AVAILABLE').length,
    booked: activeVehicles.filter(v => v.status === 'BOOKED').length,
    sold: activeVehicles.filter(v => v.status === 'SOLD').length,
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (vehicle: Vehicle) => {
    if (!confirm(`Hapus ${vehicle.make} ${vehicle.model}?`)) return;
    setDeleting(vehicle.id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/vehicles/${vehicle.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        alert('✅ Kendaraan dihapus.');
        fetchVehicles();
      } else {
        alert('Gagal menghapus.');
      }
    } catch (err) {
      alert('Error saat menghapus');
    } finally {
      setDeleting(null);
    }
  };

  if (accessDenied) {
    return <div className="p-6 text-center text-white">Akses Ditolak</div>;
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Loading vehicles...</div>;
  }

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden -mt-2">
      {/* Header */}
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl px-4 py-3 mb-3 shrink-0 shadow-lg border border-[#3a3a3a]">
        <h1 className="text-lg md:text-xl font-bold text-white">Manajemen Kendaraan</h1>
        <Link
          href="/dashboard/vehicles/upload"
          className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-md transition-all text-sm border border-emerald-500/30"
        >
          <span>+ Upload Baru</span>
        </Link>
      </div>

      {/* Filters (simplified for stability) */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-[#2a2a2a] p-2 rounded-lg border border-[#3a3a3a] shrink-0">
        <input
          type="text"
          placeholder="Cari mobil..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-[#333] border border-[#444] text-white px-3 py-1.5 rounded text-sm w-full md:w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'ALL')}
          className="bg-[#333] border border-[#444] text-white px-3 py-1.5 rounded text-sm"
        >
          <option value="ALL">Semua Status</option>
          <option value="AVAILABLE">Tersedia</option>
          <option value="BOOKED">Booking</option>
          <option value="SOLD">Terjual</option>
        </select>
        <div className="flex border border-[#444] rounded overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-[#333] text-gray-400'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-[#333] text-gray-400'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Warning/Error */}
      {resequenceStatus && (
        <div className="mb-3 p-2 bg-blue-900/30 border border-blue-800 text-blue-300 rounded text-sm text-center">
          {resequenceStatus}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredVehicles.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">Tidak ada kendaraan.</div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 gap-3' : 'flex flex-col gap-2'}>
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={`bg-[#1e1e1e] border border-[#333] rounded-lg shadow-sm hover:border-[#555] transition-all overflow-hidden ${viewMode === 'list' ? 'flex flex-row' : 'flex flex-col'}`}
              >
                {/* Image */}
                <div className={`relative bg-black ${viewMode === 'list' ? 'w-40 h-32 shrink-0' : 'h-32 w-full'}`}>
                  <VehicleImageCarousel
                    photos={vehicle.photos || []}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    aspectRatio="h-full"
                    roundedClass=""
                    showCounter={false}
                    showIndicators={false}
                    interval={99999}
                  />
                  {vehicle.status === 'SOLD' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <span className="text-white text-[10px] font-bold bg-red-600 px-2 py-0.5 rounded rotate-[-12deg]">TERJUAL</span>
                    </div>
                  )}
                </div>

                {/* Info Body */}
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  {/* Top: Title, Variant & Price */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-white leading-tight ${viewMode === 'list' ? 'text-lg' : 'text-sm truncate'}`}>
                          {vehicle.make} {vehicle.model}
                        </h3>
                        {vehicle.variant && viewMode === 'list' && (
                          <span className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs font-bold rounded border border-blue-800 uppercase">
                            {vehicle.variant}
                          </span>
                        )}
                      </div>
                      {viewMode === 'grid' && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {vehicle.year} • {vehicle.transmissionType}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-blue-400 font-bold ${viewMode === 'list' ? 'text-lg' : 'text-sm'}`}>
                        {formatPrice(vehicle.price)}
                      </div>
                      {viewMode === 'grid' && (
                        <div className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block border ${getStatusColor(vehicle.status)}`}>
                          {getStatusLabel(vehicle.status)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List View Extras: Specs, Metadata, Notes & Audit */}
                  {viewMode === 'list' && (
                    <div className="mt-3 flex flex-col gap-2">
                      {/* Specs Bar */}
                      <div className="flex items-center gap-3 text-sm text-gray-300 bg-[#252525] px-3 py-1.5 rounded border border-[#333]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Trans:</span>
                          <span className="font-medium">{vehicle.transmissionType || '-'}</span>
                        </div>
                        <div className="w-px h-4 bg-[#444]"></div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">BBM:</span>
                          <span className="font-medium">{vehicle.fuelType || '-'}</span>
                        </div>
                        <div className="w-px h-4 bg-[#444]"></div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">CC:</span>
                          <span className="font-medium">{vehicle.engineCapacity ? `${vehicle.engineCapacity} CC` : '-'}</span>
                        </div>
                        <div className="w-px h-4 bg-[#444]"></div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Tahun:</span>
                          <span className="font-medium">{vehicle.year}</span>
                        </div>
                      </div>

                      {/* Metadata Bar */}
                      <div className="flex items-center gap-3 text-sm text-gray-400 bg-[#1e1e1e] px-3 py-1.5 rounded border border-[#2a2a2a]">
                        <span className="font-mono text-gray-500">#{vehicle.displayId || vehicle.id.slice(0, 4)}</span>
                        <div className="w-px h-4 bg-[#333]"></div>
                        <span>{vehicle.mileage ? (vehicle.mileage / 1000).toFixed(0) + 'k km' : '- km'}</span>
                        <div className="w-px h-4 bg-[#333]"></div>
                        <span>{vehicle.licensePlate || 'No Plat'}</span>
                        <div className="w-px h-4 bg-[#333]"></div>
                        {(() => {
                          const diff = new Date().getTime() - new Date(vehicle.createdAt).getTime();
                          const days = Math.ceil(Math.abs(diff) / (1000 * 3600 * 24));
                          return (
                            <span className={`font-semibold ${days > 60 ? 'text-red-400' : 'text-green-400'}`}>
                              {days} Hari
                            </span>
                          );
                        })()}
                      </div>

                      {/* Note */}
                      <div className="text-sm text-gray-400 leading-snug bg-[#1a1a1a] px-3 py-2 rounded border border-[#2a2a2a]">
                        <span className="text-gray-500 font-bold uppercase mr-1.5 text-[10px]">Catatan:</span>
                        {vehicle.description || "Tidak ada catatan."}
                      </div>

                      {/* Audit Trail */}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          Updated by <span className="font-semibold text-gray-400">{vehicle.updatedBy || 'System'}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          {new Date(vehicle.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={`border-t border-[#333] bg-[#222] flex items-center gap-2 p-2 ${viewMode === 'list' ? 'border-t-0 border-l w-32 flex-col justify-center' : ''}`}>

                  {viewMode === 'list' && (
                    <span className={`w-full text-center text-[10px] uppercase font-bold py-1 rounded border ${getStatusColor(vehicle.status)}`}>
                      {getStatusLabel(vehicle.status)}
                    </span>
                  )}

                  <Link
                    href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                    className="flex-1 w-full text-center bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1.5 rounded text-xs font-medium transition-colors border border-blue-900/50"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(vehicle)}
                    disabled={deleting === vehicle.id}
                    className="px-2 py-1.5 bg-red-900/10 text-red-500 hover:bg-red-900 hover:text-white rounded text-xs border border-red-900/30"
                  >
                    {deleting === vehicle.id ? '...' : 'Hapus'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
