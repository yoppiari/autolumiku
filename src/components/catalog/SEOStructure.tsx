/**
 * SEO Structure Component
 * Generates JSON-LD for Search Engines
 */

import React from 'react';

interface SEOStructureProps {
    tenant: {
        name: string;
        domain: string | null;
        slug: string;
        description?: string;
        logoUrl?: string | null;
        address?: string | null;
        city?: string | null;
        province?: string | null;
        phoneNumber?: string | null;
        whatsappNumber?: string | null;
        email?: string | null;
    };
    vehicle?: {
        id: string;
        make: string;
        model: string;
        year: number;
        price: number;
        mileage: number | null;
        transmissionType: string | null;
        fuelType: string | null;
        color: string | null;
        photos: { thumbnailUrl: string | null; originalUrl: string }[];
        description: string | null;
    };
    isHomePage?: boolean;
}

export default function SEOStructure({ tenant, vehicle, isHomePage = false }: SEOStructureProps) {
    const baseUrl = tenant.domain ? `https://${tenant.domain}` : `https://auto.lumiku.com/catalog/${tenant.slug}`;

    // 1. LocalBusiness Schema
    const localBusinessSchema = {
        '@context': 'https://schema.org',
        '@type': 'AutoDealer',
        'name': tenant.name,
        'description': tenant.description || `Showroom mobil bekas terpercaya di ${tenant.city || 'Indonesia'}. Jual beli, tukar tambah, dan kredit mobil bekas berkualitas.`,
        'url': baseUrl,
        'logo': tenant.logoUrl || `${baseUrl}/favicon.png`,
        'image': tenant.logoUrl || `${baseUrl}/favicon.png`,
        'telephone': tenant.phoneNumber || tenant.whatsappNumber || '',
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': tenant.address || '',
            'addressLocality': tenant.city || '',
            'addressRegion': tenant.province || '',
            'addressCountry': 'ID'
        },
        'openingHoursSpecification': {
            '@type': 'OpeningHoursSpecification',
            'dayOfWeek': [
                'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
            ],
            'opens': '09:00',
            'closes': '17:00'
        }
    };

    // 2. WebSite Schema (with Search Action)
    const websiteSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'url': baseUrl,
        'name': tenant.name,
        'potentialAction': {
            '@type': 'SearchAction',
            'target': `${baseUrl}/vehicles?q={search_term_string}`,
            'query-input': 'required name=search_term_string'
        }
    };

    // 3. Vehicle (Product) Schema
    let vehicleSchema = null;
    if (vehicle) {
        vehicleSchema = {
            '@context': 'https://schema.org',
            '@type': 'Car',
            'name': `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
            'image': vehicle.photos.map(p => p.originalUrl),
            'description': vehicle.description || `Dijual ${vehicle.make} ${vehicle.model} tahun ${vehicle.year} dengan harga ${vehicle.price.toLocaleString('id-ID')}. Kondisi terawat.`,
            'brand': {
                '@type': 'Brand',
                'name': vehicle.make
            },
            'model': vehicle.model,
            'modelDate': vehicle.year,
            'color': vehicle.color || '',
            'vehicleTransmission': vehicle.transmissionType || '',
            'fuelType': vehicle.fuelType || '',
            'mileageFromOdometer': {
                '@type': 'QuantitativeValue',
                'value': vehicle.mileage || 0,
                'unitCode': 'KMT'
            },
            'offers': {
                '@type': 'Offer',
                'url': `${baseUrl}/vehicles/${vehicle.id}`,
                'priceCurrency': 'IDR',
                'price': vehicle.price,
                'availability': 'https://schema.org/InStock',
                'seller': {
                    '@type': 'AutoDealer',
                    'name': tenant.name
                }
            }
        };
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
            />
            {isHomePage && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
                />
            )}
            {vehicleSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }}
                />
            )}
        </>
    );
}
