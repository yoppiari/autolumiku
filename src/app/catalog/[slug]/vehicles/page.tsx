/**
 * Vehicles Listing Page
 * Route: /catalog/[slug]/vehicles
 * Server Component with URL-based filtering
 */

import React from 'react';
import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
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

const prisma = new PrismaClient();

interface PageProps {
    params: {
        slug: string;
    };
    searchParams: { [key: string]: string | string[] | undefined };
}

export default async function VehiclesPage({ params, searchParams }: PageProps) {
    const { slug } = params;

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

    const formatPrice = (price: number) => {
        const rupiah = price / 100;
        return `Rp ${rupiah.toLocaleString('id-ID')}`;
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
                                    return (
                                        <Card key={vehicle.id} className="hover:shadow-xl transition-shadow overflow-hidden flex flex-col">
                                            <CardHeader className="p-0">
                                                <div className="aspect-video relative">
                                                    {mainPhoto ? (
                                                        <img
                                                            src={mainPhoto.thumbnailUrl || mainPhoto.originalUrl}
                                                            alt={`${vehicle.make} ${vehicle.model}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                                            <span className="text-muted-foreground">No Image</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 flex-1">
                                                <CardTitle className="text-lg mb-2 line-clamp-1">
                                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                                </CardTitle>
                                                {vehicle.variant && (
                                                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{vehicle.variant}</p>
                                                )}
                                                <p className="text-xl font-bold text-primary">
                                                    {formatPrice(vehicle.price)}
                                                </p>
                                                <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                                                    {vehicle.mileage && <span>{vehicle.mileage.toLocaleString()} km</span>}
                                                    {vehicle.transmissionType && <span>• {vehicle.transmissionType}</span>}
                                                </div>
                                            </CardContent>
                                            <CardFooter className="p-4 pt-0 mt-auto">
                                                <Button asChild className="w-full">
                                                    <Link href={`/catalog/${tenant.slug}/vehicles/${vehicle.id}`}>Lihat Detail</Link>
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                baseUrl={`/catalog/${tenant.slug}/vehicles`}
                                searchParams={searchParams}
                            />
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">Tidak ada kendaraan yang ditemukan.</p>
                            <Button asChild variant="outline" className="mt-4">
                                <Link href={`/catalog/${tenant.slug}/vehicles`}>Reset Filter</Link>
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
