'use client';

import React, { useState } from 'react';
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
}

export default function VehicleGallery({ photos, vehicleTitle }: VehicleGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    if (!photos || photos.length === 0) {
        return (
            <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                <span className="text-muted-foreground">No Image Available</span>
            </div>
        );
    }

    const mainPhoto = photos[selectedIndex];

    return (
        <div className="space-y-4">
            {/* Main Photo */}
            <div className="bg-background rounded-lg border overflow-hidden aspect-video relative">
                <img
                    src={mainPhoto.originalUrl}
                    alt={`${vehicleTitle} - View ${selectedIndex + 1}`}
                    className="w-full h-full object-cover"
                />
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
