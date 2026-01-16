'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createVehicleSlug } from '@/lib/utils';
import { api } from '@/lib/api-client';
import VehicleImageCarousel from '@/components/ui/VehicleImageCarousel';
import { ROLE_LEVELS } from '@/lib/rbac';
import { LayoutGrid, List, Filter } from 'lucide-react';

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
  createdBy?: string; // User ID who uploaded
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
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRoleLevel, setCurrentUserRoleLevel] = useState<number>(30);

  // Filters
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<string>('');

  // Access guard & Load current user info
  // Access guard & Load current user info
  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUserId(parsedUser.id || parsedUser.userId || '');
          setCurrentUserRoleLevel(parsedUser.roleLevel || ROLE_LEVELS.SALES);
          console.log('[Vehicles] Current user loaded:', parsedUser.id, 'roleLevel:', parsedUser.roleLevel);
        } catch (e) {
          console.error('[Vehicles] Error parsing user:', e);
        }
      }
    };

    loadUser(); // Initial load

    // Listen for updates from Layout (when role is synced)
    window.addEventListener('user-updated', loadUser);

    return () => {
      window.removeEventListener('user-updated', loadUser);
    };
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
      // Get tenantId like in fetchVehicles
      const userStr = localStorage.getItem('user');
      const tenantId = userStr ? JSON.parse(userStr).tenantId : null;

      // Call with tenantId if available
      const url = tenantId ? `/api/v1/users?tenantId=${tenantId}` : '/api/v1/users';
      const result = await api.get(url);

      if (result.success && result.data) {
        // Result structure is { users: [], stats: {} } based on UsersPage
        const usersList = result.data.users || (Array.isArray(result.data) ? result.data : []);

        const mapping: Record<string, string> = {};
        usersList.forEach((user: any) => {
          // Construct full name + Phone/WA
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email?.split('@')[0] || 'Unknown';
          const phone = user.phone ? ` (${user.phone})` : '';
          mapping[user.id] = fullName + phone;
        });
        console.log('User mapping loaded:', Object.keys(mapping).length, 'users');
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
      // Return full name from mapping
      return userName;
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

  /**
   * Check if current user can edit/delete a vehicle
   * - ADMIN/OWNER/SUPER_ADMIN (roleLevel >= 90) can modify ALL vehicles
   * - SALES/STAFF (roleLevel < 90) can ONLY modify vehicles they uploaded
   */
  const canModifyVehicle = (vehicle: Vehicle): boolean => {
    // Admin+ can modify all vehicles
    if (currentUserRoleLevel >= ROLE_LEVELS.ADMIN) {
      console.log('[Permission] Admin user - full access');
      return true;
    }

    // Staff can only modify their own uploads
    const isOwner = vehicle.createdBy === currentUserId;
    console.log('[Permission] Staff check:', {
      vehicleId: vehicle.displayId,
      createdBy: vehicle.createdBy,
      currentUserId,
      isOwner,
    });
    return isOwner;
  };

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

      {/* Action Bar: Stats & Controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">

        {/* Left: Stats Badges - Scrollable & Modern */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 flex-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shadow-sm ${statusFilter === 'ALL'
              ? 'bg-slate-100 text-slate-900 border-white ring-2 ring-white/20 scale-105'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
              }`}
          >
            {vehicles.length} Total
          </button>

          <button
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shadow-sm ${statusFilter === 'AVAILABLE'
              ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
              : 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50 hover:bg-emerald-900/40'
              }`}
          >
            {stats.available} Tersedia
          </button>

          <button
            onClick={() => setStatusFilter('BOOKED')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shadow-sm ${statusFilter === 'BOOKED'
              ? 'bg-amber-600 text-white border-amber-500 ring-2 ring-amber-500/30 scale-105'
              : 'bg-amber-900/20 text-amber-500 border-amber-900/50 hover:bg-amber-900/40'
              }`}
          >
            {stats.booked} Booking
          </button>

          <button
            onClick={() => setStatusFilter('SOLD')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shadow-sm ${statusFilter === 'SOLD'
              ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30 scale-105'
              : 'bg-rose-900/20 text-rose-500 border-rose-900/50 hover:bg-rose-900/40'
              }`}
          >
            {stats.sold} Terjual
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">

          {/* View Mode Toggle - Now separate & visible */}
          <div className="flex items-center bg-[#1a1a1a] border border-[#333] rounded-lg p-1 shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-all ${viewMode === 'grid'
                ? 'bg-[#333] text-white shadow-sm scale-105'
                : 'text-gray-500 hover:text-gray-300'
                }`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <div className="w-px h-4 bg-[#333] mx-1"></div>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-all ${viewMode === 'list'
                ? 'bg-[#333] text-white shadow-sm scale-105'
                : 'text-gray-500 hover:text-gray-300'
                }`}
              title="List View"
            >
              <List size={18} />
            </button>
          </div>

          {/* New "Cooler" Mobile Filter Button */}
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`md:hidden flex items-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-lg ${isFilterExpanded
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 ring-2 ring-blue-500/30'
              : 'bg-[#2a2a2a] text-gray-200 border-[#3a3a3a] hover:bg-[#333] hover:border-[#444]'
              }`}
          >
            <Filter size={16} className={isFilterExpanded ? 'animate-bounce' : ''} />
            <span className="text-sm font-semibold">Filter</span>
          </button>
        </div>
      </div>



      {/* Filters - Collapsible on mobile, always visible on desktop */}
      <div className={`flex flex-wrap items-center gap-3 mb-4 bg-[#1f1f1f] p-3 rounded-xl border border-[#333] shadow-lg shrink-0 transition-all duration-300 ease-in-out ${isFilterExpanded ? 'block opacity-100 translate-y-0' : 'hidden md:flex opacity-0 md:opacity-100 -translate-y-2 md:translate-y-0'
        }`}>
        <div className="relative w-full md:w-64">
          {/* Search Icon */}
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Cari merk, model, atau ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#2a2a2a] border border-[#444] text-white pl-10 pr-3 py-2 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'ALL')}
          className="bg-[#2a2a2a] border border-[#444] text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none hover:border-[#555] cursor-pointer"
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
          className="bg-[#2a2a2a] border border-[#444] text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none hover:border-[#555] cursor-pointer"
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
          className="bg-[#2a2a2a] border border-[#444] text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none hover:border-[#555] cursor-pointer"
        >
          <option value="">Semua Harga</option>
          <option value="0-50">0 - 50 jt</option>
          <option value="50-100">50 - 100 jt</option>
          <option value="100-150">100 - 150 jt</option>
          <option value="150-200">150 - 200 jt</option>
          <option value="200+">200 jt+</option>
        </select>
      </div>

      {/* Warning/Error */}
      {resequenceStatus && (
        <div className="mb-3 p-2 bg-blue-900/30 border border-blue-800 text-blue-300 rounded text-sm text-center">
          {resequenceStatus}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {filteredVehicles.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">Tidak ada kendaraan.</div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 gap-3' : 'flex flex-col gap-3'}>
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={`bg-[#1e1e1e] border border-[#333] rounded-xl shadow-lg overflow-hidden flex flex-col isolate`}
              >
                {/* Main Card Layout - Flex Column to ensure bottom actions sit right */}
                <div className="flex flex-col h-full">

                  {/* Card Body: Row on List, Col on Grid */}
                  <div className={`flex flex-1 relative ${viewMode === 'list' ? 'flex-row' : 'flex-col'}`}>

                    {/* Photo Section */}
                    <div className={`relative bg-black shrink-0 overflow-hidden ${viewMode === 'list'
                      ? 'w-[35%] md:w-56 h-auto md:h-auto'
                      : 'w-full h-40'
                      }`}>
                      <VehicleImageCarousel
                        photos={vehicle.photos || []}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        aspectRatio="h-full"
                        roundedClass=""
                        showCounter={false}
                        showIndicators={false}
                        interval={99999}
                      />
                      {/* Overlay Status Label for Sold */}
                      {vehicle.status === 'SOLD' && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                          <span className="text-white text-[10px] font-bold bg-red-600 px-2 py-0.5 rounded rotate-[-12deg]">TERJUAL</span>
                        </div>
                      )}
                    </div>

                    {/* Info Section - Split Layout for Desktop List to fill empty space */}
                    <div className={`flex-1 p-1.5 md:p-2 flex flex-col min-w-0 ${viewMode === 'list'
                        ? 'md:grid md:grid-cols-2 md:gap-4 md:items-start justify-start gap-1'
                        : 'justify-between gap-1'
                      }`}>

                      {/* Left Side (Desktop List) / Top (Mobile/Grid) */}
                      <div className={`flex flex-col gap-0.5 ${viewMode === 'list' ? 'md:gap-1' : ''}`}>
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <Link href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`} className="hover:text-blue-400 transition-colors">
                            <h3 className="text-white font-bold text-xs md:text-base leading-tight line-clamp-2">
                              {vehicle.make} {vehicle.model}
                            </h3>
                          </Link>
                        </div>

                        {/* ID & Status */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-rose-400 font-bold text-[9px] md:text-xs">
                            {vehicle.displayId || vehicle.id.slice(0, 8)}
                          </span>
                          <span className={`px-1 py-px rounded text-[8px] md:text-[9px] font-bold uppercase tracking-wide border ${getStatusColor(vehicle.status)}`}>
                            {getStatusLabel(vehicle.status)}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="text-blue-400 font-bold text-sm md:text-lg">
                          {formatPrice(vehicle.price)}
                        </div>
                      </div>

                      {/* Right Side (Desktop List) / Bottom (Mobile/Grid) */}
                      <div className={`flex flex-col ${viewMode === 'list'
                          ? 'md:h-full md:justify-between md:border-l md:border-[#333] md:pl-3'
                          : ''
                        }`}>
                        {/* Specs Grid */}
                        <div className={`text-[9px] md:text-[10px] text-gray-400 ${viewMode === 'list'
                            ? 'flex flex-wrap items-center gap-1 md:grid md:grid-cols-2 md:gap-x-2 md:gap-y-1'
                            : 'grid grid-cols-2 gap-x-1 gap-y-0.5'
                          }`}>
                          {/* Variant Badge */}
                          {vehicle.variant && (
                            <span className={`px-1 py-px bg-blue-900/20 text-blue-300 rounded border border-blue-500/20 font-bold uppercase col-span-2 w-fit mb-0.5`}>
                              {vehicle.variant}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <span className={`text-gray-500 ${viewMode === 'list' ? 'hidden md:inline' : 'hidden'}`}>Thn:</span>
                            <span className="text-gray-300 font-medium">{vehicle.year}</span>
                          </span>
                          <span className={`text-gray-600 ${viewMode === 'list' ? 'md:hidden' : ''} hidden md:inline`}>•</span>

                          <span className="flex items-center gap-1">
                            <span className={`text-gray-500 ${viewMode === 'list' ? 'hidden md:inline' : 'hidden'}`}>Trs:</span>
                            <span className="text-gray-300">{vehicle.transmissionType}</span>
                          </span>
                          <span className={`text-gray-600 ${viewMode === 'list' ? 'md:hidden' : ''} hidden md:inline`}>•</span>

                          <span className="flex items-center gap-1 text-emerald-400 font-medium col-span-2">
                            {vehicle.engineCapacity ? `${vehicle.engineCapacity}cc` : ''} • {vehicle.fuelType}
                          </span>

                          {/* Mileage & Plate for Desktop List Grid */}
                          {viewMode === 'list' && (
                            <>
                              <span className="hidden md:flex gap-1 col-span-2 mt-1 pt-1 border-t border-[#333]/50 text-gray-500">
                                <span>{vehicle.mileage ? `${(vehicle.mileage / 1000).toFixed(0)}k km` : '-'}</span>
                                <span>•</span>
                                <span>{vehicle.licensePlate || 'No Plat'}</span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Updated By (Minimal) */}
                        <div className={`border-t border-[#333] text-[8px] md:text-[9px] text-gray-600 truncate flex justify-between items-center ${viewMode === 'list' ? 'mt-1 pt-1 md:mt-0' : 'mt-1 pt-1'
                          }`}>
                          <span>{getUserName(vehicle.updatedBy)}</span>
                          <span>{new Date(vehicle.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop List View Sidebar Actions */}
                    {viewMode === 'list' && (
                      <div className="hidden md:flex flex-col w-24 border-l border-[#333] bg-[#222] items-center justify-center shrink-0">
                        {canModifyVehicle(vehicle) ? (
                          <Link
                            href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                            className="w-full h-1/2 flex items-center justify-center text-xs font-bold text-blue-400 hover:bg-blue-600/10 hover:text-blue-300 transition-all uppercase tracking-wider border-b border-[#333]"
                          >
                            "edit"
                          </Link>
                        ) : (
                          <span className="w-full h-1/2 flex items-center justify-center text-xs font-bold text-gray-700 cursor-not-allowed uppercase tracking-wider border-b border-[#333]">
                            "edit"
                          </span>
                        )}

                        <button
                          onClick={() => handleDelete(vehicle)}
                          disabled={deleting === vehicle.id || !canModifyVehicle(vehicle)}
                          className={`w-full h-1/2 flex items-center justify-center text-xs font-bold transition-all uppercase tracking-wider ${canModifyVehicle(vehicle)
                            ? 'text-rose-500 hover:bg-rose-900/10 hover:text-rose-300'
                            : 'text-gray-700 cursor-not-allowed'
                            }`}
                        >
                          {deleting === vehicle.id ? '...' : '"hapus"'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions Bar - Mobile List & All Grid Views */}
                  <div className={`grid grid-cols-2 divide-x divide-[#333] border-t border-[#333] bg-[#252525] ${viewMode === 'list' ? 'md:hidden' : ''}`}>
                    {canModifyVehicle(vehicle) ? (
                      <Link
                        href={`/dashboard/vehicles/${createVehicleSlug(vehicle)}/edit`}
                        className="py-2.5 text-center text-xs font-bold text-blue-400 hover:bg-[#333] hover:text-white transition-colors uppercase tracking-wider"
                      >
                        "edit"
                      </Link>
                    ) : (
                      <span className="py-2.5 text-center text-xs font-bold text-gray-600 cursor-not-allowed uppercase tracking-wider">
                        "edit"
                      </span>
                    )}

                    <button
                      onClick={() => handleDelete(vehicle)}
                      disabled={deleting === vehicle.id || !canModifyVehicle(vehicle)}
                      className={`py-2.5 text-center text-xs font-bold transition-colors uppercase tracking-wider ${canModifyVehicle(vehicle)
                        ? 'text-rose-500 hover:bg-rose-900/20'
                        : 'text-gray-600 cursor-not-allowed'
                        }`}
                    >
                      {deleting === vehicle.id ? '...' : '"hapus"'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div >
  );
}
