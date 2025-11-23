'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VehicleCard } from '@/components/catalog/VehicleCard';
import { SearchFilters } from '@/components/catalog/SearchFilters';
import { VehiclePagination } from '@/components/catalog/VehiclePagination';
import { CatalogStats } from '@/components/catalog/CatalogStats';
import { LoadingGrid } from '@/components/catalog/LoadingGrid';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { FeaturedSection } from '@/components/catalog/FeaturedSection';
import {
  VehicleWithPhotos,
  CatalogFilters,
  CatalogResult
} from '@/services/catalog/catalog-engine.service';

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export default function PublicCatalogPage() {
  const params = useParams();
  const subdomain = params.subdomain as string;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [catalog, setCatalog] = useState<CatalogResult | null>(null);
  const [featured, setFeatured] = useState<VehicleWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current filters and pagination
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'price' | 'year' | 'mileage' | 'createdAt'>('createdAt');

  // Load tenant info
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const response = await fetch(`/api/public/${subdomain}/stats`);
        if (!response.ok) throw new Error('Tenant not found');

        const data = await response.json();
        setTenant(data.tenant);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant');
      }
    };

    if (subdomain) {
      loadTenant();
    }
  }, [subdomain]);

  // Load catalog data
  useEffect(() => {
    const loadCatalog = async () => {
      if (!tenant) return;

      setLoading(true);
      try {
        // Build query params
        const params = new URLSearchParams({
          page: currentPage.toString(),
          sortBy,
          ...(filters.make && { make: filters.make }),
          ...(filters.model && { model: filters.model }),
          ...(filters.yearMin && { yearMin: filters.yearMin.toString() }),
          ...(filters.yearMax && { yearMax: filters.yearMax.toString() }),
          ...(filters.priceMin && { priceMin: filters.priceMin.toString() }),
          ...(filters.priceMax && { priceMax: filters.priceMax.toString() }),
          ...(filters.transmission && { transmission: filters.transmission }),
          ...(filters.fuelType && { fuelType: filters.fuelType }),
          ...(filters.search && { search: filters.search }),
        });

        const response = await fetch(`/api/public/${subdomain}/search?${params}`);
        if (!response.ok) throw new Error('Failed to load catalog');

        const data = await response.json();
        setCatalog(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [tenant, currentPage, filters, sortBy]);

  // Load featured vehicles
  useEffect(() => {
    const loadFeatured = async () => {
      if (!tenant) return;

      try {
        const response = await fetch(`/api/public/${subdomain}/featured`);
        if (!response.ok) throw new Error('Failed to load featured vehicles');

        const data = await response.json();
        setFeatured(data.vehicles);
      } catch (err) {
        console.error('Failed to load featured vehicles:', err);
      }
    };

    loadFeatured();
  }, [tenant]);

  // Handle filter changes
  const handleFilterChange = (newFilters: CatalogFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle sort change
  const handleSortChange = (newSortBy: typeof sortBy) => {
    setSortBy(newSortBy);
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalog Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Catalog Header with tenant branding */}
      <CatalogHeader tenant={tenant} />

      {/* Featured Section */}
      {featured.length > 0 && (
        <FeaturedSection
          vehicles={featured}
          tenantSubdomain={subdomain}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Catalog Stats */}
        {catalog && <CatalogStats stats={catalog.filters} />}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="lg:w-80 flex-shrink-0">
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFilterChange}
              availableFilters={catalog?.filters}
              loading={loading}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Sort Bar */}
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {catalog && (
                  <>
                    Showing {((currentPage - 1) * (catalog?.limit || 12)) + 1} to{' '}
                    {Math.min(currentPage * (catalog?.limit || 12), catalog.total)} of{' '}
                    {catalog.total} vehicles
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="createdAt">Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="year_desc">Year: New to Old</option>
                  <option value="year_asc">Year: Old to New</option>
                  <option value="mileage_asc">Mileage: Low to High</option>
                </select>
              </div>
            </div>

            {/* Vehicle Grid */}
            {loading ? (
              <LoadingGrid />
            ) : catalog && catalog.vehicles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {catalog.vehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      tenantSubdomain={subdomain}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {catalog.totalPages > 1 && (
                  <div className="mt-8">
                    <VehiclePagination
                      currentPage={catalog.page}
                      totalPages={catalog.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 text-5xl mb-4">🚗</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No vehicles found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}