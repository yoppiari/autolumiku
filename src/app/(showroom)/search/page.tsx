/**
 * Search Results Page
 * Full-text search across vehicles: make, model, variant, description
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getTenantFromHeaders, getTenantBranding, getFullTenant } from '@/lib/tenant';
import GlobalHeader from '@/components/showroom/GlobalHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import VehicleCard from '@/components/catalog/VehicleCard';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hasil Pencarian - Mobil Bekas',
  description: 'Hasil pencarian mobil bekas berkualitas',
};

interface SearchPageProps {
  searchParams: {
    q?: string;
    page?: string;
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const tenant = await getTenantFromHeaders();
  const branding = await getTenantBranding();
  const fullTenant = await getFullTenant();

  if (!tenant.id || !branding || !fullTenant) {
    notFound();
  }

  const query = searchParams.q || '';
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 12;
  const skip = (page - 1) * limit;

  // If no query, show message
  if (!query.trim()) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GlobalHeader branding={branding} />

        <main className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Cari Mobil Impian Anda
            </h1>
            <p className="text-gray-600 mb-6">
              Masukkan kata kunci untuk mencari mobil (merek, model, atau deskripsi)
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </main>

        <GlobalFooter tenant={fullTenant} />
      </div>
    );
  }

  // Full-text search across make, model, variant, descriptionId
  const searchConditions = {
    OR: [
      { make: { contains: query, mode: 'insensitive' as const } },
      { model: { contains: query, mode: 'insensitive' as const } },
      { variant: { contains: query, mode: 'insensitive' as const } },
      { descriptionId: { contains: query, mode: 'insensitive' as const } },
    ],
  };

  // Fetch vehicles with search filter
  const [vehicles, totalResults] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'AVAILABLE',
        ...searchConditions,
      },
      include: {
        photos: {
          select: {
            thumbnailUrl: true,
            originalUrl: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.vehicle.count({
      where: {
        tenantId: tenant.id,
        status: 'AVAILABLE',
        ...searchConditions,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalResults / limit);

  // Record search analytics
  try {
    await prisma.searchAnalytics.create({
      data: {
        tenantId: tenant.id,
        keyword: query.trim(),
        resultCount: totalResults,
        searchedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to record search analytics:', error);
    // Don't fail the page if analytics recording fails
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalHeader branding={branding} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Beranda
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hasil Pencarian
          </h1>
          <p className="text-gray-600">
            Menampilkan <span className="font-semibold">{totalResults}</span> hasil untuk{' '}
            <span className="font-semibold text-blue-600">"{query}"</span>
          </p>
        </div>

        {/* Results */}
        {vehicles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-semibold mb-2">Tidak Ada Hasil</h3>
            <p className="text-gray-600 mb-6">
              Tidak ditemukan mobil yang sesuai dengan pencarian "{query}".
              <br />
              Coba gunakan kata kunci lain atau lihat koleksi lengkap kami.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/vehicles"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Lihat Semua Mobil
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Vehicle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  slug={branding.slug}
                  tenantId={tenant.id}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-300"
                  >
                    ← Previous
                  </Link>
                )}

                <div className="flex gap-2">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Link
                        key={pageNum}
                        href={`/search?q=${encodeURIComponent(query)}&page=${pageNum}`}
                        className={`px-4 py-2 rounded-lg ${pageNum === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>

                {page < totalPages && (
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-300"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* Search Tips */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Tips Pencarian:</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Cari berdasarkan merek: "Toyota", "Honda", "Mitsubishi"</li>
            <li>• Cari berdasarkan model: "Avanza", "Jazz", "Xpander"</li>
            <li>• Cari berdasarkan kebutuhan: "mobil keluarga", "SUV", "sedan mewah"</li>
            <li>• Gunakan kata kunci spesifik untuk hasil lebih akurat</li>
          </ul>
        </div>
      </main>

      <GlobalFooter tenant={fullTenant} />
    </div>
  );
}
