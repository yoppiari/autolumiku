'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filters
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [vehicles, statusFilter, searchQuery, sortBy]);

  const fetchVehicles = async () => {
    try {
      // TODO: Get tenantId from user session
      const userStr = localStorage.getItem('user');
      const tenantId = userStr
        ? JSON.parse(userStr).tenantId
        : null;

      if (!tenantId) {
        console.warn('⚠️ No tenantId found in localStorage. Please authenticate first.');
        console.log('💡 For development, run: devAuth.login()');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/v1/vehicles?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vehicles];

    // Status filter
    if (statusFilter !== 'ALL') {
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
    const rupiah = cents / 100000000;
    return `Rp ${rupiah.toFixed(0)} jt`;
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'AVAILABLE': return 'bg-green-100 text-green-800';
      case 'BOOKED': return 'bg-yellow-100 text-yellow-800';
      case 'SOLD': return 'bg-blue-100 text-blue-800';
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

  const stats = {
    total: vehicles.length,
    draft: vehicles.filter(v => v.status === 'DRAFT').length,
    available: vehicles.filter(v => v.status === 'AVAILABLE').length,
    booked: vehicles.filter(v => v.status === 'BOOKED').length,
    sold: vehicles.filter(v => v.status === 'SOLD').length,
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Kendaraan</h1>
            <p className="text-gray-600">Kelola inventory kendaraan showroom Anda</p>
          </div>
          <Link
            href="/dashboard/vehicles/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Kendaraan Baru
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Draft</p>
          <p className="text-2xl font-bold text-gray-500">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Tersedia</p>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Booking</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.booked}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Terjual</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sold}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Cari make, model, tahun, variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'ALL')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="AVAILABLE">Tersedia</option>
              <option value="BOOKED">Booking</option>
              <option value="SOLD">Terjual</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'price')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Terbaru</option>
              <option value="price">Harga</option>
            </select>

            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredVehicles.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada kendaraan</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Tidak ada kendaraan yang sesuai filter'
              : 'Mulai dengan upload kendaraan pertama Anda'}
          </p>
          <Link
            href="/dashboard/vehicles/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Upload Kendaraan Baru
          </Link>
        </div>
      )}

      {/* Vehicle Grid/List */}
      {filteredVehicles.length > 0 && (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
                viewMode === 'list' ? 'flex gap-4' : ''
              }`}
            >
              {/* Image */}
              <div className={viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}>
                {vehicle.photos && vehicle.photos.length > 0 ? (
                  <img
                    src={vehicle.photos[0].thumbnailUrl || vehicle.photos[0].originalUrl}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className={`w-full object-cover ${
                      viewMode === 'grid' ? 'h-48 rounded-t-lg' : 'h-full rounded-l-lg'
                    }`}
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {/* Placeholder (always rendered, hidden if image exists) */}
                <div
                  className={`bg-gray-200 flex flex-col items-center justify-center ${
                    viewMode === 'grid' ? 'h-48 rounded-t-lg' : 'h-full rounded-l-lg'
                  }`}
                  style={{ display: vehicle.photos && vehicle.photos.length > 0 ? 'none' : 'flex' }}
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500">No Photo</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {vehicle.make} {vehicle.model}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {vehicle.displayId || `ID: ${vehicle.id.slice(0, 8)}...`}
                      </p>
                      {vehicle.licensePlate && (
                        <p className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          🔒 {vehicle.licensePlate}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(vehicle.status)}`}>
                    {getStatusLabel(vehicle.status)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-2">
                  {vehicle.year} {vehicle.variant && `• ${vehicle.variant}`}
                </p>

                <p className="text-xl font-bold text-blue-600 mb-3">
                  {formatPrice(vehicle.price)}
                </p>

                <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
                  {vehicle.mileage && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {vehicle.mileage.toLocaleString()} km
                    </span>
                  )}
                  {vehicle.transmissionType && (
                    <span>• {vehicle.transmissionType}</span>
                  )}
                  {vehicle.fuelType && (
                    <span>• {vehicle.fuelType}</span>
                  )}
                  {vehicle.color && (
                    <span>• {vehicle.color}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/vehicles/${vehicle.id}/edit`}
                    className="flex-1 px-3 py-1.5 text-sm text-center bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
