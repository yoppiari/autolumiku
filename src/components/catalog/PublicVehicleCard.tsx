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
            interval={6000}
            grayscale={isSold}
            href={getUrl('')}
            overlay={
              (isSold || isBooked) && (
                <div className={`absolute inset-0 ${isSold ? 'bg-black/50' : 'bg-black/30'} flex items-center justify-center z-20 transition-all duration-500`}>
                  <div className={`
                    transform -rotate-[15deg]
                    px-6 py-2 md:px-8 md:py-3
                    rounded-lg
                    border-2
                    ${isSold ? 'border-red-400/50 bg-red-600/85' : 'border-amber-400/50 bg-amber-500/85'}
                    backdrop-blur-sm
                    shadow-2xl
                    flex items-center justify-center
                    animate-in zoom-in-50 duration-300
                  `}>
                    <span className="text-white text-xl md:text-3xl font-black tracking-widest uppercase drop-shadow-lg">
                      {isSold ? 'TERJUAL' : 'BOOKING'}
                    </span>
                  </div>
                </div>
              )
            }
            badges={
              <>
                {/* Status Badge */}
                {isSold ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-rose-600 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-xl z-20 animate-status-sold border border-rose-400/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    TERJUAL
                  </div>
                ) : isBooked ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-xl z-20 animate-status-booking border border-amber-300/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    BOOKING
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-500 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-xl z-20 animate-status-ready border border-green-300/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    TERSEDIA
                  </div>
                )}
                {/* Vehicle ID Badge - Bottom Left */}
                {vehicle.displayId && (
                  <div className="absolute bottom-8 left-3 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg z-20">
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
