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

      // Step 3: Build URL
      let url = '/api/v1/vehicles';
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
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border border-green-300';
      case 'BOOKED': return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'SOLD': return 'bg-red-100 text-red-800 border border-red-300 font-semibold';
      case 'DELETED': return 'bg-red-100 text-red-800';
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
        // Remove from local state
        setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
        alert(`✅ ${vehicle.make} ${vehicle.model} berhasil dihapus`);
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600">Anda tidak memiliki akses ke halaman Kendaraan.</p>
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
          <p className="mt-3 text-gray-600 text-sm">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden -mt-2">
      {/* Header - Gradient like Dashboard */}
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-5 py-3 mb-3 flex-shrink-0 shadow-lg ml-10 md:ml-0">
        <h1 className="text-base md:text-xl font-bold text-white">Manajemen Kendaraan</h1>
        <Link
          href="/dashboard/vehicles/upload"
          className="px-2 md:px-4 py-1.5 md:py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 flex items-center gap-1 md:gap-2 shadow-md transition-all text-xs md:text-base whitespace-nowrap"
        >
          <span className="text-base md:text-lg">+</span>
          <span className="hidden md:inline">Upload Kendaraan Baru</span>
          <span className="md:hidden">Upload</span>
        </Link>
      </div>

      {/* Stats Badges - Compact Pills, scrollable on mobile */}
      <div className="flex gap-1.5 md:gap-2 mb-3 flex-shrink-0 overflow-x-auto pb-1 scrollbar-hide">
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-white border-2 border-gray-300 rounded-full shadow-sm flex-shrink-0">
          <span className="text-sm md:text-lg font-bold text-gray-800">{stats.total}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-gray-600 font-medium">Total</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-green-50 border-2 border-green-400 rounded-full shadow-sm flex-shrink-0">
          <span className="text-sm md:text-lg font-bold text-green-600">{stats.available}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-green-700 font-medium">Tersedia</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-yellow-50 border-2 border-yellow-400 rounded-full shadow-sm flex-shrink-0">
          <span className="text-sm md:text-lg font-bold text-yellow-600">{stats.booked}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-yellow-700 font-medium">Booking</span>
        </div>
        <div className="px-2.5 md:px-4 py-1.5 md:py-2 bg-red-50 border-2 border-red-400 rounded-full shadow-sm flex-shrink-0">
          <span className="text-sm md:text-lg font-bold text-red-600">{stats.sold}</span>
          <span className="ml-1 md:ml-1.5 text-[10px] md:text-sm text-red-700 font-medium">Terjual</span>
        </div>
      </div>

      {/* Filters - Auto-hide sidebar with hover expansion */}
      <div
        className="group fixed left-0 top-20 z-40 md:relative md:top-0 md:left-0 md:z-0 mb-3 flex-shrink-0"
        onMouseEnter={() => setIsFilterExpanded(true)}
        onMouseLeave={() => setIsFilterExpanded(false)}
      >
        <div className={`bg-white rounded-r-lg md:rounded-lg shadow-lg transition-all duration-300 ease-in-out ${isFilterExpanded ? 'w-72 md:w-auto' : 'w-12 md:w-auto'
          }`}>
          {/* Collapsed state - Icon only (desktop) */}
          <div className={`md:hidden ${isFilterExpanded ? 'hidden' : 'flex flex-col items-center justify-center p-3 cursor-pointer'
            }`}>
            <span className="text-2xl mb-1">🔍</span>
            <span className="text-[10px] font-medium text-gray-600 writing-mode-vertical transform rotate-0">Filter</span>
          </div>

          {/* Expanded state - Full controls */}
          <div className={`${isFilterExpanded ? 'block' : 'hidden md:block'
            } p-2`}>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
              {/* Filter Header (mobile only when expanded) */}
              <div className="md:hidden flex items-center justify-between pb-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span>🔍</span> Filter Kendaraan
                </h3>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Cari mobil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[120px] px-2 md:px-3 py-1.5 text-xs md:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'ALL')}
                className="w-full md:w-auto px-2 py-1.5 text-xs md:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full md:w-auto px-2 py-1.5 text-xs md:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Terbaru</option>
                <option value="price">Harga Tertinggi</option>
              </select>

              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded overflow-hidden w-full md:w-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 md:flex-none px-3 md:px-2 py-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 md:flex-none px-3 md:px-2 py-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
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
        <div className={`mb-3 p-3 rounded-lg flex-shrink-0 ${resequenceStatus.includes('✅') ? 'bg-green-50 border border-green-200' :
          resequenceStatus.includes('❌') ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
          <div className="flex items-center gap-2">
            {!resequenceStatus.includes('✅') && !resequenceStatus.includes('❌') && (
              <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            )}
            <span className={`text-sm font-medium ${resequenceStatus.includes('✅') ? 'text-green-800' :
              resequenceStatus.includes('❌') ? 'text-red-800' :
                'text-blue-800'
              }`}>{resequenceStatus}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-red-800">{error}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Refresh</button>
              <button onClick={() => { localStorage.removeItem('user'); window.location.href = '/login'; }} className="px-3 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50">Login Ulang</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredVehicles.length === 0 && !loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-base font-medium text-gray-900 mb-1">Belum ada kendaraan</h3>
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
                className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${viewMode === 'list' ? 'flex gap-3' : ''
                  }`}
              >
                {/* Image Carousel - Auto-rotate every 10 seconds */}
                <div className={`relative ${viewMode === 'list' ? 'w-32 flex-shrink-0' : ''}`}>
                  <VehicleImageCarousel
                    photos={vehicle.photos || []}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    aspectRatio={viewMode === 'grid' ? 'h-32' : 'h-24'}
                    roundedClass={viewMode === 'grid' ? 'rounded-t-lg' : 'rounded-l-lg'}
                    grayscale={vehicle.status === 'SOLD'}
                    showIndicators={false}
                    showCounter={false}
                    interval={8000}
                    overlay={vehicle.status === 'SOLD' ? (
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${viewMode === 'grid' ? 'rounded-t-lg' : 'rounded-l-lg'} z-20`}>
                        <span className="text-white text-xs font-bold rotate-[-15deg] bg-red-600 px-2 py-0.5 rounded">TERJUAL</span>
                      </div>
                    ) : undefined}
                  />
                </div>

                {/* Content - Compact */}
                <div className="p-2 flex-1">
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {vehicle.make} {vehicle.model}
                      </h3>
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mt-0.5 ${getStatusColor(vehicle.status)}`}>
                        {getStatusLabel(vehicle.status)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">
                    {vehicle.displayId || vehicle.id.slice(0, 8)}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {vehicle.year} • {vehicle.variant || vehicle.transmissionType}
                  </p>

                  <p className="text-sm font-bold text-blue-600 mt-1">
                    {formatPrice(vehicle.price)}
                  </p>

                  <div className="text-[10px] text-gray-500 mt-1">
                    {vehicle.mileage?.toLocaleString()} km • {vehicle.color}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Link
                      href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                      className="flex-1 px-2 py-1 text-xs text-center bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(vehicle)}
                      disabled={deleting === vehicle.id}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                      title="Hapus kendaraan"
                    >
                      {deleting === vehicle.id ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
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
