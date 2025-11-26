/**
 * SEO Service
 * Generates SEO metadata for catalog pages
 */

export interface VehicleSEO {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string | null;
  canonical: string;
}

export class SEOService {
  /**
   * Generate SEO metadata for vehicle detail page
   */
  static generateVehicleSEO(
    vehicle: {
      make: string;
      model: string;
      year: number;
      variant?: string;
      price: number;
      descriptionId?: string;
      photos: { originalUrl: string }[];
    },
    tenantName: string,
    baseUrl: string
  ): VehicleSEO {
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
      vehicle.variant ? ` ${vehicle.variant}` : ''
    } - ${tenantName}`;

    const priceInJuta = (vehicle.price / 100000000).toFixed(0);
    const description =
      vehicle.descriptionId ||
      `Jual ${vehicle.year} ${vehicle.make} ${vehicle.model}${
        vehicle.variant ? ` ${vehicle.variant}` : ''
      } harga Rp ${priceInJuta} juta di ${tenantName}. Mobil bekas berkualitas dengan kondisi terawat.`;

    const keywords = [
      vehicle.make,
      vehicle.model,
      vehicle.year.toString(),
      vehicle.variant || '',
      'mobil bekas',
      'mobil second',
      tenantName,
      'Indonesia',
    ].filter(Boolean);

    const ogImage = vehicle.photos[0]?.originalUrl || null;

    return {
      title,
      description: description.slice(0, 160), // Meta description max 160 chars
      keywords,
      ogImage,
      canonical: baseUrl,
    };
  }

  /**
   * Generate SEO metadata for catalog listing page
   */
  static generateCatalogSEO(
    tenantName: string,
    vehicleCount: number,
    baseUrl: string
  ): VehicleSEO {
    const title = `${tenantName} - Mobil Bekas Berkualitas`;
    const description = `Temukan ${vehicleCount}+ mobil bekas berkualitas di ${tenantName}. Pilihan lengkap dengan harga terbaik dan kondisi terawat. Hubungi kami sekarang!`;

    return {
      title,
      description,
      keywords: [
        'mobil bekas',
        'mobil second',
        tenantName,
        'showroom mobil',
        'jual mobil bekas',
        'Indonesia',
      ],
      ogImage: null,
      canonical: baseUrl,
    };
  }

  /**
   * Generate JSON-LD structured data for vehicle
   */
  static generateVehicleStructuredData(vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    variant?: string;
    price: number;
    mileage?: number;
    fuelType?: string;
    transmissionType?: string;
    descriptionId?: string;
    photos: { originalUrl: string }[];
  }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Car',
      name: `${vehicle.year} ${vehicle.make} ${vehicle.model}${
        vehicle.variant ? ` ${vehicle.variant}` : ''
      }`,
      brand: {
        '@type': 'Brand',
        name: vehicle.make,
      },
      model: vehicle.model,
      vehicleModelDate: vehicle.year,
      mileageFromOdometer: vehicle.mileage
        ? {
            '@type': 'QuantitativeValue',
            value: vehicle.mileage,
            unitCode: 'KMT',
          }
        : undefined,
      fuelType: vehicle.fuelType,
      vehicleTransmission: vehicle.transmissionType,
      description: vehicle.descriptionId,
      image: vehicle.photos.map((p) => p.originalUrl),
      offers: {
        '@type': 'Offer',
        price: vehicle.price / 100000000,
        priceCurrency: 'IDR',
        availability: 'https://schema.org/InStock',
      },
    };
  }
}
