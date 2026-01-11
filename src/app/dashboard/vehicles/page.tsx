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
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<string>('');

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
      fetchUsers();
    }
  }, [accessDenied]);

  // Apply all filters
  const applyFilters = () => {
    if (!vehicles || vehicles.length === 0) {
      setFilteredVehicles([]);
      return;
    }

    let result = [...vehicles];

    // Filter by status
    if (statusFilter !== 'ALL') {
      result = result.filter(v => v.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.displayId?.toLowerCase().includes(query)
      );
    }

    // Filter by year
    if (yearFilter) {
      result = result.filter(v => v.year.toString() === yearFilter);
    }

    // Filter by price range
    if (priceFilter) {
      result = result.filter(v => {
        const price = Number(v.price) / 1000000; // Convert to millions
        if (priceFilter === '0-50') return price >= 0 && price < 50;
        if (priceFilter === '50-100') return price >= 50 && price < 100;
        if (priceFilter === '100-150') return price >= 100 && price < 150;
        if (priceFilter === '150-200') return price >= 150 && price < 200;
        if (priceFilter === '200+') return price >= 200;
        return true;
      });
    }

    // Sort
    if (sortBy === 'price') {
      result.sort((a, b) => Number(a.price) - Number(b.price));
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    setFilteredVehicles(result);
  };

  useEffect(() => {
    applyFilters();
  }, [vehicles, statusFilter, searchQuery, sortBy, yearFilter, priceFilter]);

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

  const fetchUsers = async () => {
    try {
      const result = await api.get('/api/v1/users');
      if (result.success && result.data) {
        const mapping: Record<string, string> = {};
        result.data.forEach((user: any) => {
          mapping[user.id] = user.name || user.email?.split('@')[0] || 'Unknown';
        });
        setUserMap(mapping);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const getUserName = (userId?: string): string => {
    if (!userId) return 'System';

    // If userMap is still empty, show Admin as fallback instead of loading
    if (Object.keys(userMap).length === 0) return 'Admin';

    // Try to get name from userMap
    const userName = userMap[userId];
    if (userName) {
      // Return first name only (before space) for cleaner display
      return userName.split(' ')[0];
    }

    // Fallback: show truncated UUID
    return userId.slice(0, 8) + '...';
  };

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

      {/* Stats Badges */}
      <div className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto">
        {/* Total Badge */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className="px-3 py-1.5 bg-gray-700 text-white rounded-full text-xs font-bold border border-gray-600 hover:bg-gray-600 transition-all whitespace-nowrap"
        >
          {vehicles.length} Total
        </button>

        {/* Tersedia Badge - Green with pulse animation */}
        <button
          onClick={() => setStatusFilter('AVAILABLE')}
          className="px-3 py-1.5 bg-green-600 text-white rounded-full text-xs font-bold border border-green-500 hover:bg-green-500 transition-all whitespace-nowrap animate-pulse"
        >
          {stats.available} Tersedia
        </button>

        {/* Booking Badge - Orange/Yellow with pulse animation */}
        <button
          onClick={() => setStatusFilter('BOOKED')}
          className="px-3 py-1.5 bg-amber-600 text-white rounded-full text-xs font-bold border border-amber-500 hover:bg-amber-500 transition-all whitespace-nowrap animate-pulse"
        >
          {stats.booked} Booking
        </button>

        {/* Terjual Badge - Pink/Red with pulse animation */}
        <button
          onClick={() => setStatusFilter('SOLD')}
          className="px-2 md:px-3 py-1.5 bg-rose-600 text-white rounded-full text-[11px] md:text-xs font-bold border border-rose-500 hover:bg-rose-500 transition-all whitespace-nowrap animate-pulse"
        >
          {stats.sold} Terjual
        </button>
      </div>

      {/* Filter Toggle Button - Only on mobile */}
      <div className="mb-3 shrink-0 md:hidden">
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-medium">Filter</span>
        </button>
      </div>

      {/* Filters - Collapsible on mobile, always visible on desktop */}
      <div className={`flex flex-wrap items-center gap-3 mb-4 bg-[#2a2a2a] p-2 rounded-lg border border-[#3a3a3a] shrink-0 ${isFilterExpanded ? 'block' : 'hidden md:flex'}`}>
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

        {/* Filter Tahun */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="bg-[#333] border border-[#444] text-white px-3 py-1.5 rounded text-sm"
        >
          <option value="">Semua Tahun</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2020">2020</option>
          <option value="2019">2019</option>
          <option value="2018">2018</option>
        </select>

        {/* Filter Harga */}
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          className="bg-[#333] border border-[#444] text-white px-3 py-1.5 rounded text-sm"
        >
          <option value="">Semua Harga</option>
          <option value="0-50">0 - 50 jt</option>
          <option value="50-100">50 - 100 jt</option>
          <option value="100-150">100 - 150 jt</option>
          <option value="150-200">150 - 200 jt</option>
          <option value="200+">200 jt+</option>
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
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-fr' : 'flex flex-col gap-2'}>
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={`bg-[#1e1e1e] border border-[#333] rounded-lg shadow-sm hover:border-[#555] transition-all overflow-hidden min-w-0 ${viewMode === 'list' ? 'flex flex-row w-full' : 'flex flex-col max-w-xs mx-auto'}`}
              >
                {/* Image */}
                <div className={`relative bg-black ${viewMode === 'list' ? 'w-40 h-32 shrink-0' : 'h-40 w-full'}`}>
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
                <div className="flex-1 px-2 py-1.5 flex flex-col min-w-0">

                  {/* GRID VIEW: Original Design */}
                  {viewMode === 'grid' && (
                    <div className="flex flex-col gap-1.5">
                      {/* Title */}
                      <h3 className="font-bold text-white leading-tight text-sm truncate">
                        {vehicle.make} {vehicle.model}
                      </h3>

                      {/* Status Badge */}
                      <div className={`text-[10px] px-2 py-1 rounded w-fit font-bold border flex items-center gap-1 ${getStatusColor(vehicle.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {getStatusLabel(vehicle.status)}
                      </div>

                      {/* Display ID */}
                      <div className="text-xs font-medium text-gray-400 mt-0.5">
                        {vehicle.displayId || vehicle.id.slice(0, 8)}
                      </div>

                      {/* Year and Variant/Transmission */}
                      <div className="text-xs text-gray-500">
                        {vehicle.year} • {vehicle.variant || vehicle.transmissionType}
                      </div>

                      {/* Price */}
                      <div className="text-blue-400 font-bold text-sm mt-1">
                        {formatPrice(vehicle.price)}
                      </div>

                      {/* Additional Info: km and color */}
                      <div className="text-[10px] text-gray-500">
                        {vehicle.mileage ? `${vehicle.mileage.toLocaleString('id-ID')} km` : '-'} • {vehicle.color || 'Unknown'}
                      </div>
                    </div>
                  )}

                  {/* LIST VIEW: Mobile-Responsive Clean Layout */}
                  {viewMode === 'list' && (
                    <div className="flex flex-col gap-2">
                      {/* Row 1: Title + Price (stack on mobile, horizontal on desktop) */}
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`} className="hover:text-blue-400 transition-colors">
                              <h3 className="font-bold text-white leading-tight text-base md:text-lg">
                                {vehicle.make} {vehicle.model}
                              </h3>
                            </Link>
                            <span className="font-mono text-red-400 font-bold text-sm">
                              {vehicle.displayId || '#' + vehicle.id.slice(0, 6)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {vehicle.variant && (
                              <span className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-[10px] md:text-xs font-bold rounded border border-blue-800 uppercase">
                                {vehicle.variant}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-[10px] md:text-xs font-bold rounded border uppercase md:hidden ${getStatusColor(vehicle.status)}`}>
                              {getStatusLabel(vehicle.status)}
                            </span>
                          </div>
                        </div>
                        <div className="text-blue-400 font-bold text-base md:text-lg shrink-0">
                          {formatPrice(vehicle.price)}
                        </div>
                      </div>

                      {/* Row 2: Metadata - wrap on mobile (no display ID) */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                        <span>{vehicle.year}</span>
                        <span className="text-gray-600">•</span>
                        <span>{vehicle.mileage ? vehicle.mileage.toLocaleString('id-ID') : '-'} km</span>
                        <span className="text-gray-600">•</span>
                        <span className="truncate max-w-[120px]">{vehicle.licensePlate || 'No Plat'}</span>
                        <span className="text-gray-600">•</span>
                        <div className="flex items-center gap-1">
                          <span className="hidden sm:inline">Umur Stok:</span>
                          {(() => {
                            const diff = new Date().getTime() - new Date(vehicle.createdAt).getTime();
                            const days = Math.ceil(Math.abs(diff) / (1000 * 3600 * 24));
                            return (
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${days > 60 ? 'bg-red-900/20 text-red-400 border-red-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>
                                {days} Hari
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Row 4: Updated By */}
                      <div className="text-[10px] text-gray-500">
                        Update by {getUserName(vehicle.updatedBy)} • {new Date(vehicle.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>

                      {/* Row 3: Notes */}
                      {vehicle.description && (
                        <div className="text-xs text-gray-400 leading-snug line-clamp-2">
                          {vehicle.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={`border-t border-[#333] bg-[#222] flex items-center gap-2 p-2 ${viewMode === 'list' ? 'border-t-0 border-l w-32 flex-col justify-center hidden md:flex' : ''}`}>

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
