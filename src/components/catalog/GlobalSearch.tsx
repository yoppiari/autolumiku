'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSearch } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GlobalSearchProps {
    className?: string;
    placeholder?: string;
    slug?: string;
}

export default function GlobalSearch({
    className = '',
    placeholder = 'Cari mobil impian Anda...',
    slug,
}: GlobalSearchProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            const baseUrl = slug ? `/catalog/${slug}/search` : '/search';
            router.push(`${baseUrl}?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <form onSubmit={handleSearch} className={`relative flex w-full max-w-sm items-center space-x-2 ${className}`}>
            <div className="relative w-full">
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pr-10"
                />
                <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                >
                    <FaSearch className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Search</span>
                </Button>
            </div>
        </form>
    );
}
