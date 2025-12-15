'use client';

import React, { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import SearchFilters from './SearchFilters';

interface VehicleFilterWrapperProps {
    filterOptions: {
        makes: string[];
        years: number[];
        transmissionTypes: string[];
        fuelTypes: string[];
        priceRange: { min: number; max: number };
    };
}

export default function VehicleFilterWrapper({ filterOptions }: VehicleFilterWrapperProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Create a query string from current params
    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());

            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }

            // Reset page when filter changes
            if (name !== 'page') {
                params.delete('page');
            }

            return params.toString();
        },
        [searchParams]
    );

    // Debounced updates for text inputs (search, price)
    const handleSearchDebounced = useDebouncedCallback((value: string) => {
        router.push(`${pathname}?${createQueryString('search', value)}`);
    }, 300);

    const handlePriceDebounced = useDebouncedCallback((name: string, value: string) => {
        router.push(`${pathname}?${createQueryString(name, value)}`);
    }, 300);

    const handleFilterChange = (name: string, value: string) => {
        if (name === 'search') {
            handleSearchDebounced(value);
        } else if (name === 'minPrice' || name === 'maxPrice') {
            handlePriceDebounced(name, value);
        } else {
            router.push(`${pathname}?${createQueryString(name, value)}`);
        }
    };

    const handleClearFilters = () => {
        router.push(pathname);
    };

    // Extract current filters from URL
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

    return (
        <SearchFilters
            filters={filters}
            filterOptions={filterOptions}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
        />
    );
}
