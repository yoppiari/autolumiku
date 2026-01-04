/**
 * Public Vehicle Card Component
 * Used in public catalog listing with auto-rotating image carousel
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { createVehicleSlug } from '@/lib/utils';
import VehicleImageCarousel from '@/components/ui/VehicleImageCarousel';

interface Photo {
  thumbnailUrl?: string;
  originalUrl: string;
}

interface PublicVehicleCardProps {
  vehicle: {
    id: string;
    displayId: string | null;
    make: string;
    model: string;
    year: number;
    price: number; // Serialized as number from server
    transmissionType: string | null;
    status: string;
    photos: Photo[];
  };
  slug: string;
  isCustomDomain: boolean;
  waNumber: string;
}

export default function PublicVehicleCard({
  vehicle,
  slug,
  isCustomDomain,
  waNumber,
}: PublicVehicleCardProps) {
  const isSold = vehicle.status === 'SOLD';
  const isBooked = vehicle.status === 'BOOKED';

  // Helper to format price
  const formatPrice = (price: number) => {
    return `Rp ${price.toLocaleString('id-ID')}`;
  };

  // Generate SEO-friendly slug for the vehicle link
  const vehicleSlug = createVehicleSlug({
    id: vehicle.id,
    displayId: vehicle.displayId,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year
  });

  // Helper to generate URL based on domain context
  const getUrl = (path: string) => {
    // Override path with slug-based path
    // path input is ignored but kept for signature compatibility if reused
    const vehiclePath = `/vehicles/${vehicleSlug}`;

    if (isCustomDomain) {
      return vehiclePath; // Clean URL for custom domain
    }
    return `/catalog/${slug}${vehiclePath}`; // Platform domain with catalog prefix
  };

  const waMessage = encodeURIComponent(
    `Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (${formatPrice(vehicle.price)}). Apakah unit masih tersedia?`
  );
  const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

  return (
    <div className="group">
      {/* Image Carousel */}
      <div className="mb-4">
        <Link href={getUrl('')}>
          <VehicleImageCarousel
            photos={vehicle.photos}
            alt={`${vehicle.make} ${vehicle.model}`}
            aspectRatio="aspect-[16/10]"
            roundedClass="rounded-xl"
            showIndicators={false}
            showCounter={true}
            interval={8000}
            grayscale={isSold}
            overlay={
              (isSold || isBooked) && (
                <div className={`absolute inset-0 ${isSold ? 'bg-black/40' : 'bg-black/20'} flex items-center justify-center z-20`}>
                  <span className={`text-white text-2xl font-bold tracking-wider rotate-[-15deg] ${isSold ? 'bg-red-600' : 'bg-yellow-500'} px-4 py-2 rounded shadow-xl`}>
                    {isSold ? 'TERJUAL' : 'BOOKING'}
                  </span>
                </div>
              )
            }
            badges={
              <>
                {/* Status Badge */}
                {isSold ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg z-10">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    SOLD
                  </div>
                ) : isBooked ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-yellow-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg z-10">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    BOOKING
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg z-10">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    Ready
                  </div>
                )}
                {/* Vehicle ID Badge - Bottom Left */}
                {vehicle.displayId && (
                  <div className="absolute bottom-8 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg z-20">
                    {vehicle.displayId}
                  </div>
                )}
              </>
            }
          />
        </Link>
      </div>

      {/* Vehicle Info */}
      {/* Vehicle Info */}
      <div className="space-y-2 px-1">
        <Link href={getUrl('')}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {vehicle.make} {vehicle.model}
              </h3>
              <p className="text-sm text-muted-foreground">
                {vehicle.year} • {vehicle.transmissionType || 'N/A'}
              </p>
            </div>
            <p className="text-lg font-bold text-primary whitespace-nowrap">
              {formatPrice(vehicle.price)}
            </p>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <Button
            asChild
            className={`${isSold ? 'w-full' : 'flex-1'} rounded-full`}
            variant="outline"
            size="sm"
          >
            <Link href={getUrl('')}>Detail</Link>
          </Button>
          {waNumber && !isSold && (
            <Button
              asChild
              className="flex-1 rounded-full bg-green-500 hover:bg-green-600 text-white"
              size="sm"
            >
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
}
