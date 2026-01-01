/**
 * Search Filters Component for Catalog
 * Updated to use shadcn/ui components with local state for responsive typing
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

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
  // Local state for expansion
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for text inputs (instant response while typing)
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localMinPrice, setLocalMinPrice] = useState(filters.minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(filters.maxPrice);

  // Sync local state when URL params change (e.g., on clear or external navigation)
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setLocalMinPrice(filters.minPrice);
  }, [filters.minPrice]);

  useEffect(() => {
    setLocalMaxPrice(filters.maxPrice);
  }, [filters.maxPrice]);

  // Debounced handlers for text inputs
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    onChange('search', value);
  }, [onChange]);

  const handleMinPriceChange = useCallback((value: string) => {
    setLocalMinPrice(value);
    onChange('minPrice', value);
  }, [onChange]);

  const handleMaxPriceChange = useCallback((value: string) => {
    setLocalMaxPrice(value);
    onChange('maxPrice', value);
  }, [onChange]);

  // Handle clear with local state reset
  const handleClear = useCallback(() => {
    setLocalSearch('');
    setLocalMinPrice('');
    setLocalMaxPrice('');
    onClear();
  }, [onClear]);

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6 transition-all duration-300">
      {/* Header / Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 md:p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Filter Kendaraan</h2>
            {!isExpanded && (
              <p className="text-sm text-gray-500">
                {hasActiveFilters ? 'Beberapa filter sedang aktif' : 'Cari berdasarkan merk, harga, atau tahun'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasActiveFilters && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              variant="ghost"
              size="sm"
              className="hidden md:flex text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium"
            >
              Reset Filter
            </Button>
          )}
          <div className="p-1 rounded-full bg-gray-50 group-hover:bg-white border border-gray-100 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </div>

      {/* Filter Grid */}
      <div
        className={`px-6 pb-6 transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
      >
        <div className="pt-4 border-t border-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Search */}
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Cari Kendaraan
              </Label>
              <Input
                id="search"
                type="text"
                placeholder="Cari merk, model, variant..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
              />
            </div>

            {/* Make */}
            <div>
              <Label htmlFor="make" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Merk
              </Label>
              <Select value={filters.make || undefined} onValueChange={(value) => onChange('make', value)}>
                <SelectTrigger id="make" className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Semua Merk" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.makes.map((make) => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div>
              <Label htmlFor="sortBy" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Urutkan
              </Label>
              <Select value={filters.sortBy} onValueChange={(value) => onChange('sortBy', value)}>
                <SelectTrigger id="sortBy" className="bg-gray-50 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Terbaru</SelectItem>
                  <SelectItem value="price-asc">Harga Terendah</SelectItem>
                  <SelectItem value="price-desc">Harga Tertinggi</SelectItem>
                  <SelectItem value="year-desc">Tahun Terbaru</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div>
              <Label htmlFor="minPrice" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Harga Min (juta)
              </Label>
              <Input
                id="minPrice"
                type="number"
                placeholder="0"
                value={localMinPrice}
                onChange={(e) => handleMinPriceChange(e.target.value)}
                className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
              />
            </div>

            <div>
              <Label htmlFor="maxPrice" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Harga Max (juta)
              </Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder={filterOptions.priceRange.max.toString()}
                value={localMaxPrice}
                onChange={(e) => handleMaxPriceChange(e.target.value)}
                className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
              />
            </div>

            {/* Year Range */}
            <div>
              <Label htmlFor="minYear" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Tahun Min
              </Label>
              <Select value={filters.minYear || undefined} onValueChange={(value) => onChange('minYear', value)}>
                <SelectTrigger id="minYear" className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxYear" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Tahun Max
              </Label>
              <Select value={filters.maxYear || undefined} onValueChange={(value) => onChange('maxYear', value)}>
                <SelectTrigger id="maxYear" className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transmission */}
            <div>
              <Label htmlFor="transmission" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Transmisi
              </Label>
              <Select value={filters.transmissionType || undefined} onValueChange={(value) => onChange('transmissionType', value)}>
                <SelectTrigger id="transmission" className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.transmissionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fuel Type */}
            <div>
              <Label htmlFor="fuelType" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Bahan Bakar
              </Label>
              <Select value={filters.fuelType || undefined} onValueChange={(value) => onChange('fuelType', value)}>
                <SelectTrigger id="fuelType" className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.fuelTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex md:hidden">
            {hasActiveFilters && (
              <Button
                onClick={handleClear}
                variant="outline"
                className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                Reset Semua Filter
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
