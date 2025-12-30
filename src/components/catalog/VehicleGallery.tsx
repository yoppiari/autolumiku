'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VehiclePhoto {
    id: string;
    originalUrl: string;
    thumbnailUrl: string;
    displayOrder: number;
}

interface VehicleGalleryProps {
    photos: VehiclePhoto[];
    vehicleTitle: string;
    displayId?: string | null;
    status?: 'AVAILABLE' | 'SOLD' | 'RESERVED' | string;
}

export default function VehicleGallery({ photos, vehicleTitle, displayId, status }: VehicleGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-rotate every 10 seconds
    useEffect(() => {
        if (photos.length <= 1 || isPaused) return;

        const interval = setInterval(() => {
            setSelectedIndex((prev) => (prev + 1) % photos.length);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [photos.length, isPaused]);

    if (!photos || photos.length === 0) {
        return (
            <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                <span className="text-muted-foreground">No Image Available</span>
            </div>
        );
    }

    const mainPhoto = photos[selectedIndex];
    const isAvailable = status === 'AVAILABLE';
    const isSold = status === 'SOLD';

    return (
        <div className="space-y-4">
            {/* Main Photo */}
            <div
                className="bg-background rounded-lg border overflow-hidden aspect-video relative"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                <img
                    src={mainPhoto.originalUrl}
                    alt={`${vehicleTitle} - View ${selectedIndex + 1}`}
                    className={cn("w-full h-full object-cover", isSold && "grayscale")}
                />

                {/* Status Badge - Top Left */}
                {status && (
                    <div className={cn(
                        "absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg",
                        isAvailable && "bg-green-500 text-white",
                        isSold && "bg-red-600 text-white",
                        !isAvailable && !isSold && "bg-yellow-500 text-white"
                    )}>
                        {isAvailable && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                        {isAvailable ? 'Ready' : isSold ? 'SOLD' : 'Reserved'}
                    </div>
                )}

                {/* Vehicle ID Badge - Bottom Left */}
                {displayId && (
                    <div className="absolute bottom-3 left-3 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded shadow-lg z-20">
                        {displayId}
                    </div>
                )}

                {/* Note: License plates are now covered at upload time using AI detection */}
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {photos.map((photo, index) => (
                        <button
                            key={photo.id}
                            onClick={() => setSelectedIndex(index)}
                            className={cn(
                                "relative aspect-video rounded-md overflow-hidden border-2 transition-all",
                                selectedIndex === index
                                    ? "border-primary ring-2 ring-primary/20"
                                    : "border-transparent hover:border-muted-foreground/50"
                            )}
                        >
                            <img
                                src={photo.thumbnailUrl || photo.originalUrl}
                                alt={`${vehicleTitle} - Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
