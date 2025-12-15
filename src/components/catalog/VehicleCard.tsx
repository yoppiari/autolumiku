/**
 * Vehicle Card Component for Catalog
 * Updated to use shadcn/ui components
 * WITH WhatsApp AI Dual Contact (Story 8.6)
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import WhatsAppContactModal from './WhatsAppContactModal';

interface VehicleCardProps {
  vehicle: {
    id: string;
    displayId: string | null;
    make: string;
    model: string;
    year: number;
    variant: string | null;
    price: bigint | number;
    mileage: number | null;
    transmissionType: string | null;
    fuelType: string | null;
    photos: { thumbnailUrl: string; originalUrl: string }[];
  };
  slug: string;
  tenantId?: string | null;
  onWhatsAppClick?: (vehicle: any) => void;
}

export default function VehicleCard({ vehicle, slug, tenantId, onWhatsAppClick }: VehicleCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatPrice = (price: bigint | number) => {
    const rupiah = Number(price) / 100;
    return `Rp ${rupiah.toLocaleString('id-ID')}`;
  };

  const handleWhatsAppClick = async () => {
    // Open dual contact modal
    setIsModalOpen(true);

    // Call the original handler if provided
    if (onWhatsAppClick) {
      onWhatsAppClick(vehicle);
    }
  };

  const mainPhoto = vehicle.photos[0];
  const photoUrl = mainPhoto?.thumbnailUrl || mainPhoto?.originalUrl;

  return (
    <Card className="hover:shadow-xl transition-shadow overflow-hidden">
      {/* Image */}
      <Link href={`/catalog/${slug}/vehicles/${vehicle.id}`}>
        <div className="relative aspect-[16/10] bg-gray-200">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <CardContent className="p-4">
        <Link href={`/catalog/${slug}/vehicles/${vehicle.id}`}>
          <h3 className="font-bold text-lg text-foreground mb-1 hover:text-primary transition-colors">
            {vehicle.make} {vehicle.model}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            {vehicle.year}
            {vehicle.variant && ` • ${vehicle.variant}`}
          </p>
        </Link>

        <p className="text-2xl font-bold text-foreground mb-3">
          {formatPrice(vehicle.price)}
        </p>

        {/* Specs */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {vehicle.mileage && (
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {vehicle.mileage.toLocaleString()} km
            </span>
          )}
          {vehicle.transmissionType && <span>• {vehicle.transmissionType}</span>}
          {vehicle.fuelType && <span>• {vehicle.fuelType}</span>}
        </div>
      </CardContent>

      {/* Actions */}
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button asChild className="flex-1" variant="default">
          <Link href={`/catalog/${slug}/vehicles/${vehicle.id}`}>
            Lihat Detail
          </Link>
        </Button>
        <Button
          onClick={handleWhatsAppClick}
          className="bg-green-600 hover:bg-green-700"
          size="default"
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          WA
        </Button>
      </CardFooter>

      {/* WhatsApp Contact Modal (AI vs Human) */}
      {tenantId && (
        <WhatsAppContactModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          vehicle={{
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            price: Number(vehicle.price), // Convert BigInt to number
          }}
          tenantId={tenantId}
        />
      )}
    </Card>
  );
}
