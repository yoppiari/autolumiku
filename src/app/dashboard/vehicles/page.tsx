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
  photos: { thumbnailUrl: string; originalUrl: string }[];
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

  // Access guard: All authenticated users can access vehicles
  // No role restrictions - all roles (Sales, Admin, Owner, Super Admin) can access
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const roleLevel = parsedUser.roleLevel || ROLE_LEVELS.SALES;
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

  // Auto-fix vehicle IDs when vehicles are loaded
  useEffect(() => {
    const fixVehicleIds = async () => {
      if (vehicles.length === 0) return;

      // Filter active vehicles only
      const activeVehicles = vehicles.filter(v => v.status !== 'DELETED');
      if (activeVehicles.length === 0) return;

      // Sort by createdAt to find the first vehicle
      const sorted = [...activeVehicles].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const firstVehicle = sorted[0];
      if (!firstVehicle?.displayId) return;

      // Check if first ID is not 001
      const match = firstVehicle.displayId.match(/-(\d+)$/);
      if (!match) return;

      const firstSeq = parseInt(match[1], 10);
      if (firstSeq <= 1) return; // Already correct

      // Need to fix IDs
      setResequenceStatus('🔄 Memperbaiki urutan ID kendaraan...');

      const slug = detectSlugFromDomain();
      if (!slug) return;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/v1/vehicles?action=resequence-ids&slug=${slug}`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });

        const result = await response.json();
        console.log('[Vehicles] Resequence result:', result);

        if (response.ok && result.success) {
          setResequenceStatus('✅ ID berhasil diperbaiki! Memuat ulang...');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          console.error('[Vehicles] Resequence failed:', result);
          setResequenceStatus(null);
        }
      } catch (err) {
        console.error('[Vehicles] Resequence error:', err);
        setResequenceStatus(null);
      }
    };

    fixVehicleIds();
  }, [vehicles]);

  /**
   * Detect tenant slug from current domain
   */
  const detectSlugFromDomain = (): string | null => {
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;

    // Custom domain mapping
    const domainMap: Record<string, string> = {
      'primamobil.id': 'primamobil-id',
      'www.primamobil.id': 'primamobil-id',
      'localhost': 'primamobil-id',
    };

    return domainMap[hostname] || null;
  };

  // State for resequence status
  const [resequenceStatus, setResequenceStatus] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      setError(null);

      // Step 1: Try to get tenantId from localStorage
      const userStr = localStorage.getItem('user');
      const tenantId = userStr ? JSON.parse(userStr).tenantId : null;

      // Step 2: Detect slug from domain
      const slug = detectSlugFromDomain();

      // Step 3: Build URL with cache-busting
      let url = `/api/v1/vehicles?_t=${Date.now()}`;
      if (slug) {
        console.log(`[Vehicles] Fetching by slug: ${slug}`);
        url = `/api/v1/vehicles?slug=${slug}`;
      } else if (tenantId) {
        console.log(`[Vehicles] Fetching by tenantId: ${tenantId}`);
        url = `/api/v1/vehicles?tenantId=${tenantId}`;
      } else {
        setError('Tidak dapat mendeteksi tenant. Silakan login ulang.');
        setLoading(false);
        return;
      }

      // Use api client which handles auth headers
      const result = await api.get(url);

      if (result.success) {
        setVehicles(result.data || []);
        console.log(`[Vehicles] ✅ Loaded ${result.data?.length || 0} vehicles`);
      } else {
        console.error('[Vehicles] API error:', result.error);
        setError(result.error || 'Gagal memuat data kendaraan');
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      setError('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vehicles];

    // ALWAYS hide DELETED vehicles unless explicitly filtering for them
    // Deleted vehicles are test/removed vehicles that shouldn't appear in normal view
    if (statusFilter !== 'DELETED') {
      filtered = filtered.filter(v => v.status !== 'DELETED');
    }

    // Status filter (for non-deleted statuses)
    if (statusFilter !== 'ALL' && statusFilter !== 'DELETED') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.year.toString().includes(query) ||
        (v.variant && v.variant.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return b.price - a.price;
      }
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

  // Stats should NOT count DELETED vehicles (test/removed vehicles)
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
    const confirmMsg = `Hapus ${vehicle.make} ${vehicle.model} (${vehicle.displayId || vehicle.id.slice(0, 8)})?\n\nTindakan ini akan menghapus kendaraan secara permanen.`;

    if (!confirm(confirmMsg)) return;

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
        // Refresh entire list to reflect resequenced IDs (Server-Side)
        alert(`✅ ${vehicle.make} ${vehicle.model} berhasil dihapus. ID kendaraan lain telah diurutkan ulang.`);
        fetchVehicles();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(`Gagal menghapus: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Terjadi kesalahan saat menghapus');
    } finally {
      setDeleting(null);
    }
  };

  // Show access denied message briefly before redirect
  if (accessDenied) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-white mb-2">Akses Ditolak</h2>
          <p className="text-gray-400">Anda tidak memiliki akses ke halaman Kendaraan.</p>
          <p className="text-sm text-gray-500 mt-2">Mengalihkan ke Dashboard...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-400 text-sm">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden -mt-2">
      {/* Header - Gradient like Dashboard */}
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl px-3 md:px-5 py-3 mb-3 flex-shrink-0 shadow-lg ml-10 md:ml-0 border border-[#3a3a3a]">
        <h1 className="text-base md:text-xl font-bold text-white">Manajemen Kendaraan</h1>
        <Link
          href="/dashboard/vehicles/upload"
          className="px-2 md:px-4 py-1.5 md:py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 flex items-center gap-1 md:gap-2 shadow-md transition-all text-xs md:text-base whitespace-nowrap border border-emerald-500/30"
        >
          <span className="text-base md:text-lg">+</span>
          <span className="hidden md:inline">Upload Kendaraan Baru</span>
          <span className="md:hidden">Upload</span>
        </Link>
      </div>

      {/* Stats Badges - Compact Pills, scrollable on mobile */}
      <div className="flex gap-1.5 md:gap-2 mb-3 flex-shrink-0 overflow-x-auto pb-1 scrollbar-hide">
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-full shadow-sm flex-shrink-0">
          <span className="text-sm md:text-lg font-bold text-white">{stats.total}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-gray-400 font-medium">Total</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-gradient-to-br from-green-900/60 to-green-800/60 border-2 border-green-700/50 rounded-full shadow-md flex-shrink-0 animate-status-ready">
          <span className="text-sm md:text-lg font-bold text-green-100">{stats.available}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-green-200/90 font-bold">Tersedia</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-gradient-to-br from-amber-900/60 to-amber-800/60 border-2 border-amber-700/50 rounded-full shadow-md flex-shrink-0 animate-status-booking">
          <span className="text-sm md:text-lg font-bold text-amber-100">{stats.booked}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-amber-200/90 font-bold">Booking</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-gradient-to-br from-rose-900/60 to-rose-800/60 border-2 border-rose-700/50 rounded-full shadow-md flex-shrink-0 animate-status-sold">
          <span className="text-sm md:text-lg font-bold text-rose-100">{stats.sold}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-rose-200/90 font-bold">Terjual</span>
        </div>
      </div>

      {/* Filters - Auto-hide sidebar with hover expansion */}
      <div
        className="group fixed left-0 top-20 z-40 md:relative md:top-0 md:left-0 md:z-0 mb-3 flex-shrink-0"
        onMouseEnter={() => setIsFilterExpanded(true)}
        onMouseLeave={() => setIsFilterExpanded(false)}
      >
        <div className={`bg-[#2a2a2a] border border-[#3a3a3a] rounded-r-lg md:rounded-lg shadow-lg transition-all duration-300 ease-in-out ${isFilterExpanded ? 'w-72 md:w-auto' : 'w-12 md:w-auto'
          }`}>
          {/* Collapsed state - Icon only (desktop) */}
          <div className={`md:hidden ${isFilterExpanded ? 'hidden' : 'flex flex-col items-center justify-center p-3 cursor-pointer'
            }`}>
            <span className="text-2xl mb-1">🔍</span>
            <span className="text-[10px] font-medium text-gray-400 writing-mode-vertical transform rotate-0">Filter</span>
          </div>

          {/* Expanded state - Full controls */}
          <div className={`${isFilterExpanded ? 'block' : 'hidden md:block'
            } p-2`}>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
              {/* Filter Header (mobile only when expanded) */}
              <div className="md:hidden flex items-center justify-between pb-2 border-b border-[#3a3a3a]">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <span>🔍</span> Filter Kendaraan
                </h3>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Cari mobil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[120px] px-2 md:px-3 py-1.5 text-xs md:text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'ALL')}
                className="w-full md:w-auto px-2 py-1.5 text-xs md:text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="DRAFT">Draft</option>
                <option value="AVAILABLE">Tersedia</option>
                <option value="BOOKED">Booking</option>
                <option value="SOLD">Terjual</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price')}
                className="w-full md:w-auto px-2 py-1.5 text-xs md:text-sm bg-[#333] border border-[#444] text-white rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Terbaru</option>
                <option value="price">Harga Tertinggi</option>
              </select>

              {/* View Toggle */}
              <div className="flex border border-[#444] rounded overflow-hidden w-full md:w-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 md:flex-none px-3 md:px-2 py-1.5 ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-[#333] text-gray-400'}`}
                >
                  <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 md:flex-none px-3 md:px-2 py-1.5 ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-[#333] text-gray-400'}`}
                >
                  <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resequence Status */}
      {resequenceStatus && (
        <div className={`mb-3 p-3 rounded-lg flex-shrink-0 ${resequenceStatus.includes('✅') ? 'bg-green-900/30 border border-green-800' :
          resequenceStatus.includes('❌') ? 'bg-red-900/30 border border-red-800' :
            'bg-blue-900/30 border border-blue-800'
          }`}>
          <div className="flex items-center gap-2">
            {!resequenceStatus.includes('✅') && !resequenceStatus.includes('❌') && (
              <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            )}
            <span className={`text-sm font-medium ${resequenceStatus.includes('✅') ? 'text-green-400' :
              resequenceStatus.includes('❌') ? 'text-red-400' :
                'text-blue-400'
              }`}>{resequenceStatus}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-red-300">{error}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="px-3 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-800">Refresh</button>
              <button onClick={() => { localStorage.removeItem('user'); window.location.href = '/login'; }} className="px-3 py-1 border border-red-700 text-red-400 rounded text-xs hover:bg-red-900/30">Login Ulang</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredVehicles.length === 0 && !loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-base font-medium text-gray-300 mb-1">Belum ada kendaraan</h3>
            <p className="text-sm text-gray-500 mb-3">
              {searchQuery || statusFilter !== 'ALL' ? 'Tidak ada yang sesuai filter' : 'Upload kendaraan pertama Anda'}
            </p>
            <Link href="/dashboard/vehicles/upload" className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Upload Kendaraan
            </Link>
          </div>
        </div>
      )}

      {/* Vehicle Grid/List - Scrollable */}
      {filteredVehicles.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3'
              : 'space-y-2'
          }>
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={`bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow hover:shadow-black/40 hover:border-[#444] transition-all ${viewMode === 'list' ? 'flex gap-3' : ''
                  }`}
              >
                {/* Image Carousel - Larger in List View */}
                <div className={`relative ${viewMode === 'list' ? 'w-full md:w-56 h-48 md:h-auto flex-shrink-0' : ''}`}>
                  <VehicleImageCarousel
                    photos={vehicle.photos || []}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    aspectRatio={viewMode === 'grid' ? 'h-32' : 'h-full'}
                    roundedClass={viewMode === 'grid' ? 'rounded-t-lg' : 'rounded-t-lg md:rounded-l-lg md:rounded-tr-none'}
                    grayscale={vehicle.status === 'SOLD'}
                    showIndicators={viewMode === 'list'}
                    showCounter={false}
                    interval={7000}
                    overlay={vehicle.status === 'SOLD' ? (
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center ${viewMode === 'grid' ? 'rounded-t-lg' : 'rounded-l-lg'} z-20`}>
                        <span className="text-white text-xs font-bold rotate-[-15deg] bg-red-600 px-2 py-0.5 rounded shadow-lg">TERJUAL</span>
                      </div>
                    ) : undefined}
                  />
                </div>

                {/* Content Container */}
                <div className={`flex-1 p-3 ${viewMode === 'list' ? 'flex flex-col md:flex-row gap-4' : ''}`}>

                  {/* CENTRAL INFO (List View) / MAIN INFO (Grid View) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {/* Title & Status */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className={`font-bold text-gray-100 truncate ${viewMode === 'list' ? 'text-lg' : 'text-sm'}`}>
                            {vehicle.make} {vehicle.model}
                          </h3>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {vehicle.year} • {vehicle.variant || vehicle.transmissionType}
                          </div>
                        </div>

                        {viewMode === 'grid' && (
                          <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${getStatusColor(vehicle.status)}`}>
                            {getStatusLabel(vehicle.status)}
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <p className={`font-bold text-blue-400 mt-2 ${viewMode === 'list' ? 'text-xl' : 'text-sm'}`}>
                        {formatPrice(vehicle.price)}
                      </p>

                      {/* List View Only: Aging Badge & ID */}
                      {viewMode === 'list' && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="text-xs font-semibold text-gray-400 bg-[#333] px-2 py-1 rounded border border-[#444]">
                            #{vehicle.displayId || vehicle.id.slice(0, 8)}
                          </span>

                          {/* Stock Health / Aging Badge */}
                          {(() => {
                            const created = new Date(vehicle.createdAt);
                            const now = new Date();
                            const diffTime = Math.abs(now.getTime() - created.getTime());
                            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            let colorClass = 'bg-green-900/40 text-green-400 border-green-800';
                            let label = 'New Arrival';

                            if (days > 60) {
                              colorClass = 'bg-red-900/40 text-red-400 border-red-800';
                              label = 'Over Age';
                            } else if (days > 30) {
                              colorClass = 'bg-yellow-900/40 text-yellow-400 border-yellow-800';
                              label = 'Standard Stock';
                            }

                            return (
                              <span className={`px-2 py-1 text-xs font-medium rounded border ${colorClass} flex items-center gap-1.5`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {label} ({days} Hari)
                              </span>
                            );
                          })()}
                        </div>
                      )}

                      {/* Grid View: Compact Info */}
                      {viewMode === 'grid' && (
                        <>
                          <p className="text-xs font-medium text-gray-500 mt-1 bg-[#1a1a1a] px-1.5 py-0.5 rounded inline-block">
                            {vehicle.displayId || vehicle.id.slice(0, 8)}
                          </p>
                          <div className="text-[10px] text-gray-500 mt-1">
                            {vehicle.mileage?.toLocaleString()} km • {vehicle.color}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: SPECS (List View Only) */}
                  {viewMode === 'list' && (
                    <div className="w-full md:w-64 flex flex-col gap-3 border-l border-[#3a3a3a] pl-0 md:pl-4 pt-4 md:pt-0">
                      {/* Specs Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#333]/50 p-2 rounded flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase">Transmisi</span>
                          <span className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            {vehicle.transmissionType || '-'}
                          </span>
                        </div>
                        <div className="bg-[#333]/50 p-2 rounded flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase">Bahan Bakar</span>
                          <span className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            {vehicle.fuelType || '-'}
                          </span>
                        </div>
                        <div className="bg-[#333]/50 p-2 rounded flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase">Kilometer</span>
                          <span className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6" /></svg>
                            {vehicle.mileage?.toLocaleString() || '-'}
                          </span>
                        </div>
                        <div className="bg-[#333]/50 p-2 rounded flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase">Plat Nomor</span>
                          <span className="text-xs font-medium text-gray-200 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                            {vehicle.licensePlate || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Status & Actions - Bottom Right */}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full border shadow-sm ${getStatusColor(vehicle.status)}`}>
                          {getStatusLabel(vehicle.status)}
                        </span>

                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                            className="px-3 py-1.5 text-xs text-center bg-blue-600/80 text-white rounded hover:bg-blue-700 font-medium transition-colors flex items-center gap-1"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(vehicle)}
                            disabled={deleting === vehicle.id}
                            className="px-3 py-1.5 text-xs bg-red-900/40 border border-red-800 text-red-200 rounded hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {deleting === vehicle.id ? '...' : 'Hapus'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid View Actions (Bottom) */}
                  {viewMode === 'grid' && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#333]">
                      <Link
                        href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                        className="flex-1 px-2 py-1 text-xs text-center bg-blue-600/20 border border-blue-900 text-blue-300 rounded hover:bg-blue-600 hover:text-white font-medium transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(vehicle)}
                        disabled={deleting === vehicle.id}
                        className="px-2 py-1 text-xs bg-red-900/10 border border-red-900 text-red-400 rounded hover:bg-red-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Hapus kendaraan"
                      >
                        {deleting === vehicle.id ? '...' : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
      }
    </div >
  );
}
