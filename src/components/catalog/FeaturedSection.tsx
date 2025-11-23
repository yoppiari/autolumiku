'use client';

import { VehicleWithPhotos } from '@/services/catalog/catalog-engine.service';
import { VehicleCard } from './VehicleCard';

interface FeaturedSectionProps {
  vehicles: VehicleWithPhotos[];
  tenantSubdomain: string;
}

export function FeaturedSection({ vehicles, tenantSubdomain }: FeaturedSectionProps) {
  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Featured Vehicles
          </h2>
          <p className="text-gray-600">
            Hand-picked premium vehicles from our collection
          </p>
        </div>

        {/* Featured Vehicles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.slice(0, 6).map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              tenantSubdomain={tenantSubdomain}
            />
          ))}
        </div>

        {/* View All Button */}
        {vehicles.length > 6 && (
          <div className="text-center mt-8">
            <a
              href={`/catalog/${tenantSubdomain}?featured=true`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Featured Vehicles
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
