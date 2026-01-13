'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DataManagementPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/data-management/scraper');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-white">Redirecting to Vehicle Scraper...</div>
        </div>
    );
}
