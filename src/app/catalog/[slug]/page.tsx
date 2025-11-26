/**
 * Public Catalog Page
 * Route: /catalog/[slug]
 */

'use client';

import React, { useState, useEffect, use } from 'react';
import VehicleCard from '@/components/catalog/VehicleCard';
import SearchFilters from '@/components/catalog/SearchFilters';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import CatalogFooter from '@/components/catalog/CatalogFooter';
import HeroSection from '@/components/catalog/HeroSection';
import ThemeProvider from '@/components/catalog/ThemeProvider';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function CatalogPage({ params }: PageProps) {
  const { slug } = use(params);

  const [branding, setBranding] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [layoutConfig, setLayoutConfig] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);

  const [filters, setFilters] = useState({
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

  useEffect(() => {
    fetchBranding();
  }, [slug]);

  useEffect(() => {
    fetchVehicles();
  }, [slug, filters, currentPage]);

  const fetchBranding = async () => {
    try {
      const response = await fetch(`/api/public/branding/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setBranding(data.data);

        // Fetch full business info and layout config
        if (data.data.tenantId) {
          const businessResponse = await fetch(`/api/v1/tenants/${data.data.tenantId}/business-info`);
          if (businessResponse.ok) {
            const businessData = await businessResponse.json();
            setBusinessInfo(businessData.data);
          }

          const layoutResponse = await fetch(`/api/v1/catalog/layout?tenantId=${data.data.tenantId}`);
          if (layoutResponse.ok) {
            const layoutData = await layoutResponse.json();
            setLayoutConfig(layoutData.data);
          }
        }
      } else {
        setError('Showroom tidak ditemukan');
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err);
      setError('Gagal memuat data showroom');
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...(filters.search && { search: filters.search }),
        ...(filters.make && { make: filters.make }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(filters.minYear && { minYear: filters.minYear }),
        ...(filters.maxYear && { maxYear: filters.maxYear }),
        ...(filters.transmissionType && {
          transmissionType: filters.transmissionType,
        }),
        ...(filters.fuelType && { fuelType: filters.fuelType }),
        sortBy: filters.sortBy,
        page: currentPage.toString(),
        limit: '12',
      });

      const response = await fetch(
        `/api/public/catalog/${slug}?${queryParams.toString()}`
      );

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
    setCurrentPage(1); // Reset to first page when filters change
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

    const phoneNumber = '6281234567890'; // TODO: Get from tenant settings
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, '_blank');
  };

  if (error && !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!branding) {
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
    <ThemeProvider tenantId={branding.tenantId}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <CatalogHeader
          branding={branding}
          vehicleCount={totalVehicles}
          phoneNumber={businessInfo?.phoneNumber}
          whatsappNumber={businessInfo?.whatsappNumber}
          slug={slug}
        />

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          {layoutConfig?.heroEnabled && (
            <HeroSection
              title={layoutConfig.heroTitle}
              subtitle={layoutConfig.heroSubtitle}
              imageUrl={layoutConfig.heroImageUrl}
              primaryColor={branding.primaryColor}
            />
          )}

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
                  slug={slug}
                  tenantId={branding.tenantId}
                  onWhatsAppClick={handleWhatsAppClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-md ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && vehicles.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Tidak ada kendaraan ditemukan
            </h3>
            <p className="text-gray-600 mb-4">
              Coba ubah filter pencarian Anda
            </p>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

        {/* Footer */}
        {businessInfo && (
          <CatalogFooter businessInfo={businessInfo} slug={slug} />
        )}
      </div>
    </ThemeProvider>
  );
}
