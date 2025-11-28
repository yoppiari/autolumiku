/**
 * Search Results Page
 * Route: /catalog/[slug]/search
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import VehicleCard from '@/components/catalog/VehicleCard';
import SearchFilters from '@/components/catalog/SearchFilters';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import Pagination from '@/components/catalog/Pagination';
import { Button } from '@/components/ui/button';

interface PageProps {
    params: {
        slug: string;
    };
}

export default function SearchPage({ params }: PageProps) {
    const { slug } = params;
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [branding, setBranding] = useState<any>(null);
    const [businessInfo, setBusinessInfo] = useState<any>(null);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [filterOptions, setFilterOptions] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState(1);
    const [totalVehicles, setTotalVehicles] = useState(0);

    // Derive filters from URL search params
    const filters = {
        search: searchParams.get('search') || '',
        make: searchParams.get('make') || '',
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || '',
        minYear: searchParams.get('minYear') || '',
        maxYear: searchParams.get('maxYear') || '',
        transmissionType: searchParams.get('transmissionType') || '',
        fuelType: searchParams.get('fuelType') || '',
        sortBy: searchParams.get('sortBy') || 'date-desc',
    };

    const currentPage = Number(searchParams.get('page')) || 1;

    useEffect(() => {
        fetchBranding();
    }, [slug]);

    useEffect(() => {
        if (branding) {
            fetchVehicles();
        }
    }, [branding, searchParams]);

    const fetchBranding = async () => {
        try {
            const response = await fetch(`/api/public/branding/${slug}`);
            if (response.ok) {
                const data = await response.json();
                setBranding(data.data);

                // Fetch full business info
                if (data.data.tenantId) {
                    const businessResponse = await fetch(`/api/v1/tenants/${data.data.tenantId}/business-info`);
                    if (businessResponse.ok) {
                        const businessData = await businessResponse.json();
                        setBusinessInfo(businessData.data);
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
            // Construct query params from searchParams, ensuring page and limit are set
            const queryParams = new URLSearchParams(searchParams.toString());
            if (!queryParams.has('page')) queryParams.set('page', '1');
            if (!queryParams.has('limit')) queryParams.set('limit', '12');

            // Ensure sortBy is set if missing
            if (!queryParams.has('sortBy')) queryParams.set('sortBy', 'date-desc');

            const response = await fetch(`/api/public/catalog/${slug}?${queryParams.toString()}`);

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
        const current = new URLSearchParams(Array.from(searchParams.entries()));

        if (value) {
            current.set(name, value);
        } else {
            current.delete(name);
        }

        // Reset to page 1 when filter changes
        current.set('page', '1');

        const search = current.toString();
        const query = search ? `?${search}` : '';

        router.push(`${pathname}${query}`);
    };

    const handleClearFilters = () => {
        router.push(pathname);
    };

    const handleWhatsAppClick = (vehicle: any) => {
        const message = `Halo, saya tertarik dengan ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ''
            } (ID: ${vehicle.displayId || vehicle.id.slice(0, 8)})`;

        const phoneNumber = businessInfo?.whatsappNumber?.replace(/[^0-9]/g, '') || '6281234567890';
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // Convert searchParams to plain object for Pagination component
    const searchParamsObj: { [key: string]: string } = {};
    searchParams.forEach((value, key) => {
        searchParamsObj[key] = value;
    });

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
            <div className="min-h-screen bg-background flex flex-col">
                <CatalogHeader
                    branding={branding}
                    vehicleCount={totalVehicles}
                    phoneNumber={businessInfo?.phoneNumber}
                    whatsappNumber={businessInfo?.whatsappNumber}
                    slug={slug}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-2">
                            Hasil Pencarian
                        </h1>
                        {filters.search && (
                            <p className="text-muted-foreground">
                                Menampilkan hasil untuk "{filters.search}"
                            </p>
                        )}
                    </div>

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
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-muted-foreground">Memuat kendaraan...</p>
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
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                baseUrl={pathname}
                                searchParams={searchParamsObj}
                            />
                        </>
                    )}

                    {/* Empty State */}
                    {!loading && vehicles.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">Tidak ada kendaraan yang sesuai dengan pencarian Anda.</p>
                            <Button onClick={handleClearFilters} variant="outline" className="mt-4">
                                Reset Filter
                            </Button>
                        </div>
                    )}
                </main>

                {businessInfo && (
                    <GlobalFooter
                        tenant={{
                            name: branding.name,
                            phoneNumber: businessInfo.phoneNumber,
                            phoneNumberSecondary: businessInfo.phoneNumberSecondary,
                            whatsappNumber: businessInfo.whatsappNumber,
                            email: businessInfo.email,
                            address: businessInfo.address,
                            city: businessInfo.city,
                            province: businessInfo.province,
                            primaryColor: branding.primaryColor,
                        }}
                    />
                )}
            </div>
        </ThemeProvider>
    );
}
