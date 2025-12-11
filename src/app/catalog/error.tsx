'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Catalog Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50 dark:bg-zinc-900 border-2 border-red-500">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Something went wrong!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                We encountered an error while loading this showroom. Please try again later.
            </p>
            <div className="flex gap-4">
                <Button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                >
                    Try again
                </Button>
            </div>
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-8 p-4 bg-red-50 text-red-800 rounded-md text-left text-xs overflow-auto max-w-2xl w-full">
                    <p className="font-bold">{error.name}: {error.message}</p>
                    <pre className="mt-2">{error.stack}</pre>
                </div>
            )}
        </div>
    );
}
