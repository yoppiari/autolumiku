/**
 * Vehicles Listing Page
 * Route: /catalog/[slug]/vehicles
 * Server Component with URL-based filtering
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { FaWhatsapp } from 'react-icons/fa';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import VehicleFilterWrapper from '@/components/catalog/VehicleFilterWrapper';
import Pagination from '@/components/catalog/Pagination';
import { CatalogEngineService, CatalogFilters } from '@/lib/services/catalog/catalog-engine.service';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/prisma';


interface PageProps {
    params: {
        slug: string;
    };
    searchParams: { [key: string]: string | string[] | undefined };
}

export default async function VehiclesPage({ params, searchParams }: PageProps) {
    const { slug } = params;
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';

    // 1. Fetch Tenant
    const tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant) {
        return notFound();
    }

    const tenantId = tenant.id;

    // 2. Parse Filters
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1;
    const limit = 12;

    const filters: CatalogFilters = {
        search: typeof searchParams.search === 'string' ? searchParams.search : undefined,
        make: typeof searchParams.make === 'string' ? searchParams.make : undefined,
        minPrice: typeof searchParams.minPrice === 'string' ? parseFloat(searchParams.minPrice) : undefined,
        maxPrice: typeof searchParams.maxPrice === 'string' ? parseFloat(searchParams.maxPrice) : undefined,
        minYear: typeof searchParams.minYear === 'string' ? parseInt(searchParams.minYear) : undefined,
        maxYear: typeof searchParams.maxYear === 'string' ? parseInt(searchParams.maxYear) : undefined,
        transmissionType: typeof searchParams.transmissionType === 'string' ? searchParams.transmissionType : undefined,
        fuelType: typeof searchParams.fuelType === 'string' ? searchParams.fuelType : undefined,
        sortBy: (typeof searchParams.sortBy === 'string' ? searchParams.sortBy : 'date-desc') as any,
        page,
        limit,
    };

    // 3. Fetch Vehicles
    const result = await CatalogEngineService.getVehicles(tenantId, filters);
    const { vehicles, totalPages, total, filters: filterOptions } = result;

    const formatPrice = (price: bigint | number) => {
        const numPrice = typeof price === 'bigint' ? Number(price) : price;
        const rupiah = numPrice / 100;
        return `Rp ${rupiah.toLocaleString('id-ID')}`;
    };

    // Generate URLs based on domain context
    const getUrl = (path: string) => {
        if (isCustomDomain) {
            return path; // Clean URL for custom domain
        }
        return `/catalog/${tenant.slug}${path}`; // Platform domain with catalog prefix
    };

    return (
        <ThemeProvider tenantId={tenantId}>
            <div className="min-h-screen bg-background flex flex-col">
                <CatalogHeader
                    branding={{
                        name: tenant.name,
                        logoUrl: tenant.logoUrl,
                        primaryColor: tenant.primaryColor,
                        secondaryColor: tenant.secondaryColor,
                        slug: tenant.slug,
                    }}
                    vehicleCount={total}
                    phoneNumber={tenant.phoneNumber || undefined}
                    whatsappNumber={tenant.whatsappNumber || undefined}
                    slug={tenant.slug}
                    isCustomDomain={isCustomDomain}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-2">
                            Koleksi Mobil
                        </h1>
                        <p className="text-muted-foreground">
                            Temukan berbagai pilihan mobil berkualitas dengan harga terbaik
                        </p>
                    </div>

                    {/* Filters */}
                    <VehicleFilterWrapper filterOptions={filterOptions} />

                    {/* Vehicle Grid */}
                    {vehicles.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                                {vehicles.map((vehicle) => {
                                    const mainPhoto = vehicle.photos[0];
                                    const photoUrl = mainPhoto?.thumbnailUrl || mainPhoto?.originalUrl;
                                    const waNumber = tenant.whatsappNumber?.replace(/[^0-9]/g, '') || '';
                                    const waMessage = encodeURIComponent(`Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (${formatPrice(vehicle.price)}). Apakah unit masih tersedia?`);
                                    const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

                                    const isSold = vehicle.status === 'SOLD';

                                    return (
                                        <div key={vehicle.id} className="group">
                                            <div className="aspect-[16/10] relative rounded-xl overflow-hidden mb-4 bg-muted">
                                                <Link href={getUrl(`/vehicles/${vehicle.id}`)}>
                                                    {photoUrl ? (
                                                        <img
                                                            src={photoUrl}
                                                            alt={`${vehicle.make} ${vehicle.model}`}
                                                            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isSold ? 'grayscale' : ''}`}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                            No Image
                                                        </div>
                                                    )}
                                                </Link>
                                                {/* Status Badge */}
                                                {isSold ? (
                                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        SOLD
                                                    </div>
                                                ) : (
                                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
                                                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                                        Ready
                                                    </div>
                                                )}
                                                {/* SOLD Overlay */}
                                                {isSold && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <span className="text-white text-2xl font-bold tracking-wider rotate-[-15deg] bg-red-600 px-4 py-2 rounded">TERJUAL</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2 px-1">
                                                <Link href={getUrl(`/vehicles/${vehicle.id}`)}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                                                {vehicle.make} {vehicle.model}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">{vehicle.year} • {vehicle.transmissionType || 'N/A'}</p>
                                                        </div>
                                                        <p className="text-lg font-bold text-primary whitespace-nowrap">
                                                            {formatPrice(vehicle.price)}
                                                        </p>
                                                    </div>
                                                </Link>
                                                {/* Action Buttons */}
                                                <div className="pt-2 flex gap-2">
                                                    <Button asChild className={`${isSold ? 'w-full' : 'flex-1'} rounded-full`} variant="outline" size="sm">
                                                        <Link href={getUrl(`/vehicles/${vehicle.id}`)}>Detail</Link>
                                                    </Button>
                                                    {waNumber && !isSold && (
                                                        <Button asChild className="flex-1 rounded-full bg-green-500 hover:bg-green-600 text-white" size="sm">
                                                            <a href={waLink} target="_blank" rel="noopener noreferrer">
                                                                <FaWhatsapp className="w-4 h-4 mr-1" />
                                                                WhatsApp
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                baseUrl={getUrl('/vehicles')}
                                searchParams={searchParams}
                            />
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">Tidak ada kendaraan yang ditemukan.</p>
                            <Button asChild variant="outline" className="mt-4">
                                <Link href={getUrl('/vehicles')}>Reset Filter</Link>
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
        </ThemeProvider>
    );
}
