/**
 * Search Filters Component for Catalog
 * Updated to use shadcn/ui components
 */

import React from 'react';
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
          <Button
            onClick={onClear}
            variant="link"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset Semua Filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <Label htmlFor="search" className="text-gray-700 mb-1">
            Cari Kendaraan
          </Label>
          <Input
            id="search"
            type="text"
            placeholder="Cari merk, model, variant..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
          />
        </div>

        {/* Make */}
        <div>
          <Label htmlFor="make" className="text-gray-700 mb-1">
            Merk
          </Label>
          <Select value={filters.make || undefined} onValueChange={(value) => onChange('make', value)}>
            <SelectTrigger id="make">
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
          <Label htmlFor="sortBy" className="text-gray-700 mb-1">
            Urutkan
          </Label>
          <Select value={filters.sortBy} onValueChange={(value) => onChange('sortBy', value)}>
            <SelectTrigger id="sortBy">
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
          <Label htmlFor="minPrice" className="text-gray-700 mb-1">
            Harga Min (juta)
          </Label>
          <Input
            id="minPrice"
            type="number"
            placeholder="0"
            value={filters.minPrice}
            onChange={(e) => onChange('minPrice', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="maxPrice" className="text-gray-700 mb-1">
            Harga Max (juta)
          </Label>
          <Input
            id="maxPrice"
            type="number"
            placeholder={filterOptions.priceRange.max.toString()}
            value={filters.maxPrice}
            onChange={(e) => onChange('maxPrice', e.target.value)}
          />
        </div>

        {/* Year Range */}
        <div>
          <Label htmlFor="minYear" className="text-gray-700 mb-1">
            Tahun Min
          </Label>
          <Select value={filters.minYear || undefined} onValueChange={(value) => onChange('minYear', value)}>
            <SelectTrigger id="minYear">
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
          <Label htmlFor="maxYear" className="text-gray-700 mb-1">
            Tahun Max
          </Label>
          <Select value={filters.maxYear || undefined} onValueChange={(value) => onChange('maxYear', value)}>
            <SelectTrigger id="maxYear">
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
          <Label htmlFor="transmission" className="text-gray-700 mb-1">
            Transmisi
          </Label>
          <Select value={filters.transmissionType || undefined} onValueChange={(value) => onChange('transmissionType', value)}>
            <SelectTrigger id="transmission">
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
          <Label htmlFor="fuelType" className="text-gray-700 mb-1">
            Bahan Bakar
          </Label>
          <Select value={filters.fuelType || undefined} onValueChange={(value) => onChange('fuelType', value)}>
            <SelectTrigger id="fuelType">
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
    </div>
  );
}
