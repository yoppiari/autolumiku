'use client';

import Image from 'next/image';
import Link from 'next/link';
import { VehicleWithPhotos } from '@/services/catalog/catalog-engine.service';

interface VehicleCardProps {
  vehicle: VehicleWithPhotos;
  tenantSubdomain: string;
}

export function VehicleCard({ vehicle, tenantSubdomain }: VehicleCardProps) {
  const mainPhoto = vehicle.photos.find(photo => photo.isMainPhoto) || vehicle.photos[0];
  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(vehicle.price);

  const formatMileage = (mileage: number) => {
    if (mileage >= 1000) {
      return `${(mileage / 1000).toFixed(1)}k km`;
    }
    return `${mileage.toLocaleString()} km`;
  };

  const getTransmissionLabel = (transmission: string) => {
    switch (transmission?.toUpperCase()) {
      case 'MANUAL':
        return 'Manual';
      case 'AUTOMATIC':
        return 'Automatic';
      case 'CVT':
        return 'CVT';
      case 'DCT':
        return 'DCT';
      default:
        return transmission || 'Unknown';
    }
  };

  const getFuelTypeLabel = (fuelType: string) => {
    switch (fuelType?.toUpperCase()) {
      case 'GASOLINE':
        return 'Bensin';
      case 'DIESEL':
        return 'Diesel';
      case 'ELECTRIC':
        return 'Electric';
      case 'HYBRID':
        return 'Hybrid';
      case 'PLUGIN_HYBRID':
        return 'Plug-in Hybrid';
      default:
        return fuelType || 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden group">
      {/* Vehicle Image */}
      <Link href={`/catalog/${tenantSubdomain}/vehicles/${vehicle.id}`}>
        <div className="relative aspect-[16/12] overflow-hidden bg-gray-100">
          {mainPhoto ? (
            <Image
              src={mainPhoto.url}
              alt={`${vehicle.make} ${vehicle.model} ${vehicle.year}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-gray-400 text-4xl">🚗</div>
            </div>
          )}

          {/* Featured Badge */}
          {vehicle.isFeatured && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
              Featured
            </div>
          )}

          {/* Vehicle Count Badge */}
          {vehicle.photos.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded-md text-xs">
              {vehicle.photos.length} photos
            </div>
          )}
        </div>
      </Link>

      {/* Vehicle Details */}
      <div className="p-4">
        <Link href={`/catalog/${tenantSubdomain}/vehicles/${vehicle.id}`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-1 hover:text-blue-600 transition-colors">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
        </Link>

        {vehicle.variant && (
          <p className="text-sm text-gray-600 mb-2">{vehicle.variant}</p>
        )}

        {/* Price */}
        <div className="text-xl font-bold text-blue-600 mb-3">
          {formattedPrice}
        </div>

        {/* Key Specifications */}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>{formatMileage(vehicle.mileage)}</span>
          </div>

          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{vehicle.year}</span>
          </div>

          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span>{getTransmissionLabel(vehicle.transmissionType)}</span>
          </div>

          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <span>{getFuelTypeLabel(vehicle.fuelType)}</span>
          </div>
        </div>

        {/* Tags */}
        {vehicle.tags && vehicle.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {vehicle.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
              >
                {tag}
              </span>
            ))}
            {vehicle.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-md">
                +{vehicle.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Categories */}
        {vehicle.categories && vehicle.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {vehicle.categories.slice(0, 2).map((category, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        {vehicle.status && vehicle.status !== 'AVAILABLE' && (
          <div className="mt-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
              ${vehicle.status === 'SOLD' ? 'bg-red-100 text-red-800' :
                vehicle.status === 'RESERVED' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'}
            `}>
              {vehicle.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}