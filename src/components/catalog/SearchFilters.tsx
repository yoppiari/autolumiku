'use client';

import { useState, useEffect } from 'react';
import { CatalogFilters } from '@/services/catalog/catalog-engine.service';

interface SearchFiltersProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  availableFilters?: {
    makes: string[];
    models: string[];
    years: number[];
    priceRange: { min: number; max: number };
  };
  loading?: boolean;
}

const transmissionOptions = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'AUTOMATIC', label: 'Automatic' },
  { value: 'CVT', label: 'CVT' },
  { value: 'DCT', label: 'DCT' },
];

const fuelTypeOptions = [
  { value: 'GASOLINE', label: 'Bensin' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'PLUGIN_HYBRID', label: 'Plug-in Hybrid' },
];

export function SearchFilters({
  filters,
  onFiltersChange,
  availableFilters,
  loading
}: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<CatalogFilters>(filters);
  const [priceRange, setPriceRange] = useState({
    min: filters.priceMin || availableFilters?.priceRange.min || 0,
    max: filters.priceMax || availableFilters?.priceRange.max || 1000000000,
  });
  const [yearRange, setYearRange] = useState({
    min: filters.yearMin || Math.min(...(availableFilters?.years || [2020])),
    max: filters.yearMax || Math.max(...(availableFilters?.years || [2024])),
  });

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
    if (filters.priceMin || filters.priceMax) {
      setPriceRange({
        min: filters.priceMin || priceRange.min,
        max: filters.priceMax || priceRange.max,
      });
    }
    if (filters.yearMin || filters.yearMax) {
      setYearRange({
        min: filters.yearMin || yearRange.min,
        max: filters.yearMax || yearRange.max,
      });
    }
  }, [filters]);

  // Debounced filter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({
        ...localFilters,
        priceMin: priceRange.min > 0 ? priceRange.min : undefined,
        priceMax: priceRange.max < 1000000000 ? priceRange.max : undefined,
        yearMin: yearRange.min > 0 ? yearRange.min : undefined,
        yearMax: yearRange.max < 2030 ? yearRange.max : undefined,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [localFilters, priceRange, yearRange]);

  const handleSearchChange = (value: string) => {
    setLocalFilters({ ...localFilters, search: value });
  };

  const handleMakeChange = (value: string) => {
    const newFilters = { ...localFilters, make: value || undefined, model: undefined };
    setLocalFilters(newFilters);
  };

  const handleModelChange = (value: string) => {
    setLocalFilters({ ...localFilters, model: value || undefined });
  };

  const handleTransmissionChange = (value: string) => {
    setLocalFilters({ ...localFilters, transmission: value || undefined });
  };

  const handleFuelTypeChange = (value: string) => {
    setLocalFilters({ ...localFilters, fuelType: value || undefined });
  };

  const clearFilters = () => {
    setLocalFilters({});
    setPriceRange({
      min: availableFilters?.priceRange.min || 0,
      max: availableFilters?.priceRange.max || 1000000000,
    });
    setYearRange({
      min: Math.min(...(availableFilters?.years || [2020])),
      max: Math.max(...(availableFilters?.years || [2024])),
    });
    onFiltersChange({});
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <button
          onClick={clearFilters}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Clear All
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search
        </label>
        <input
          type="text"
          placeholder="Search make, model, variant..."
          value={localFilters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Make Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Make
        </label>
        <select
          value={localFilters.make || ''}
          onChange={(e) => handleMakeChange(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">All Makes</option>
          {availableFilters?.makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>
      </div>

      {/* Model Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model
        </label>
        <select
          value={localFilters.model || ''}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={loading || !localFilters.make}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">All Models</option>
          {localFilters.make && availableFilters?.models
            .filter(model => model.includes(localFilters.make!))
            .map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
        </select>
      </div>

      {/* Year Range */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Year Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="From"
            value={yearRange.min}
            onChange={(e) => setYearRange({ ...yearRange, min: parseInt(e.target.value) || 0 })}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder="To"
            value={yearRange.max}
            onChange={(e) => setYearRange({ ...yearRange, max: parseInt(e.target.value) || 2024 })}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Price Range */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Price Range (IDR)
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">From:</span>
            <input
              type="number"
              placeholder="Min price"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">To:</span>
            <input
              type="number"
              placeholder="Max price"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 0 })}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {availableFilters?.priceRange && (
          <p className="text-xs text-gray-500 mt-1">
            Available: {formatPrice(availableFilters.priceRange.min)} - {formatPrice(availableFilters.priceRange.max)}
          </p>
        )}
      </div>

      {/* Transmission */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transmission
        </label>
        <select
          value={localFilters.transmission || ''}
          onChange={(e) => handleTransmissionChange(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Transmissions</option>
          {transmissionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Fuel Type */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fuel Type
        </label>
        <select
          value={localFilters.fuelType || ''}
          onChange={(e) => handleFuelTypeChange(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Fuel Types</option>
          {fuelTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}