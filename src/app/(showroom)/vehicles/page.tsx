/**
 * All Vehicles Page (formerly /catalog/[slug])
 * Route: /vehicles
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import VehicleCard from '@/components/catalog/VehicleCard';
import SearchFilters from '@/components/catalog/SearchFilters';
import GlobalHeader from '@/components/showroom/GlobalHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import { Button } from '@/components/ui/button';

export default function VehiclesPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('q') || '';

  const [tenant, setTenant] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);

  const [filters, setFilters] = useState({
    search: initialSearch,
    make: '',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    transmissionType: '',
    fuelType: '',
    sortBy: 'date-desc',
  });

  useEffect(() => {
    fetchTenantData();
  }, []);

  useEffect(() => {
    if (tenant) {
      fetchVehicles();
    }
  }, [tenant, filters, currentPage]);

  const fetchTenantData = async () => {
    try {
      // Get tenant slug from window location or headers
      const response = await fetch(window.location.origin + '/api/public/tenant-info');
      if (response.ok) {
        const data = await response.json();
        setTenant(data.tenant);
        setBranding(data.branding);
      } else {
        setError('Showroom tidak ditemukan');
      }
    } catch (err) {
      console.error('Failed to fetch tenant:', err);
      setError('Gagal memuat data showroom');
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        tenantId: tenant.id,
        ...(filters.search && { search: filters.search }),
        ...(filters.make && { make: filters.make }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(filters.minYear && { minYear: filters.minYear }),
        ...(filters.maxYear && { maxYear: filters.maxYear }),
        ...(filters.transmissionType && { transmissionType: filters.transmissionType }),
        ...(filters.fuelType && { fuelType: filters.fuelType }),
        sortBy: filters.sortBy,
        page: currentPage.toString(),
        limit: '12',
      });

      const response = await fetch(`/api/public/catalog/${tenant.slug}?${queryParams.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setVehicles(data.data.vehicles);
        setFilterOptions(data.data.filters);
        setTotalPages(data.data.totalPages);
        setTotalVehicles(data.data.total);
      } else {
        setError('Gagal memuat daftar kendaraan');
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setError('Gagal memuat daftar kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      make: '',
      minPrice: '',
      maxPrice: '',
      minYear: '',
      maxYear: '',
      transmissionType: '',
      fuelType: '',
      sortBy: 'date-desc',
    });
    setCurrentPage(1);
  };

  const handleWhatsAppClick = (vehicle: any) => {
    const message = `Halo, saya tertarik dengan ${vehicle.year} ${vehicle.make} ${vehicle.model}${
      vehicle.variant ? ` ${vehicle.variant}` : ''
    } (ID: ${vehicle.displayId || vehicle.id.slice(0, 8)})`;

    const phoneNumber = tenant?.whatsappNumber?.replace(/[^0-9]/g, '') || '6281234567890';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (error && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!tenant || !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <GlobalHeader
        branding={{
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          slug: tenant.slug,
        }}
      />

      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Semua Kendaraan ({totalVehicles})
        </h1>

        {/* Filters */}
        {filterOptions && (
          <SearchFilters
            filters={filters}
            filterOptions={filterOptions}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat kendaraan...</p>
          </div>
        )}

        {/* Vehicle Grid */}
        {!loading && vehicles.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  slug={tenant.slug}
                  tenantId={tenant.id}
                  onWhatsAppClick={handleWhatsAppClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                >
                  Sebelumnya
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        variant={currentPage === page ? 'default' : 'outline'}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                >
                  Selanjutnya
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && vehicles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Tidak ada kendaraan yang sesuai dengan filter Anda.</p>
            <Button onClick={handleClearFilters} variant="outline" className="mt-4">
              Reset Filter
            </Button>
          </div>
        )}
      </main>

      <GlobalFooter
        tenant={{
          name: tenant.name,
          phoneNumber: tenant.phoneNumber,
          phoneNumberSecondary: tenant.phoneNumberSecondary,
          whatsappNumber: tenant.whatsappNumber,
          email: tenant.email,
          address: tenant.address,
          city: tenant.city,
          province: tenant.province,
          primaryColor: tenant.primaryColor,
        }}
      />
    </div>
  );
}
