/**
 * Search Filters Component for Catalog
 */

import React from 'react';

interface SearchFiltersProps {
  filters: {
    search: string;
    make: string;
    minPrice: string;
    maxPrice: string;
    minYear: string;
    maxYear: string;
    transmissionType: string;
    fuelType: string;
    sortBy: string;
  };
  filterOptions: {
    makes: string[];
    years: number[];
    transmissionTypes: string[];
    fuelTypes: string[];
    priceRange: { min: number; max: number };
  };
  onChange: (name: string, value: string) => void;
  onClear: () => void;
}

export default function SearchFilters({
  filters,
  filterOptions,
  onChange,
  onClear,
}: SearchFiltersProps) {
  const hasActiveFilters =
    filters.search ||
    filters.make ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minYear ||
    filters.maxYear ||
    filters.transmissionType ||
    filters.fuelType;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Filter Kendaraan</h2>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset Semua Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cari Kendaraan
          </label>
          <input
            type="text"
            placeholder="Cari merk, model, variant..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Make */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Merk
          </label>
          <select
            value={filters.make}
            onChange={(e) => onChange('make', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Merk</option>
            {filterOptions.makes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Urutkan
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => onChange('sortBy', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Terbaru</option>
            <option value="price-asc">Harga Terendah</option>
            <option value="price-desc">Harga Tertinggi</option>
            <option value="year-desc">Tahun Terbaru</option>
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Harga Min (juta)
          </label>
          <input
            type="number"
            placeholder="0"
            value={filters.minPrice}
            onChange={(e) => onChange('minPrice', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Harga Max (juta)
          </label>
          <input
            type="number"
            placeholder={filterOptions.priceRange.max.toString()}
            value={filters.maxPrice}
            onChange={(e) => onChange('maxPrice', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Year Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tahun Min
          </label>
          <select
            value={filters.minYear}
            onChange={(e) => onChange('minYear', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua</option>
            {filterOptions.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tahun Max
          </label>
          <select
            value={filters.maxYear}
            onChange={(e) => onChange('maxYear', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua</option>
            {filterOptions.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Transmission */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transmisi
          </label>
          <select
            value={filters.transmissionType}
            onChange={(e) => onChange('transmissionType', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua</option>
            {filterOptions.transmissionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Fuel Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bahan Bakar
          </label>
          <select
            value={filters.fuelType}
            onChange={(e) => onChange('fuelType', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua</option>
            {filterOptions.fuelTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
