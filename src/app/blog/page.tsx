import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Blog - Tips & Panduan Mobil Bekas',
  description:
    'Artikel, tips, dan panduan lengkap seputar membeli, merawat, dan memilih mobil bekas berkualitas',
  keywords: 'blog mobil bekas, tips mobil bekas, panduan membeli mobil, review mobil',
};

interface BlogListPageProps {
  searchParams: {
    category?: string;
    page?: string;
  };
}

export default async function BlogListPage({ searchParams }: BlogListPageProps) {
  const category = searchParams.category;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 12;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    status: 'PUBLISHED',
  };

  if (category) {
    where.category = category;
  }

  // Fetch posts
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: true,
        featuredImage: true,
        publishedAt: true,
        wordCount: true,
        views: true,
        authorName: true,
        targetLocation: true,
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Category filter options
  const categories = [
    { value: 'BUYING_GUIDE', label: 'Panduan Membeli', icon: '📖' },
    { value: 'COMPARISON', label: 'Perbandingan', icon: '⚖️' },
    { value: 'MAINTENANCE_TIPS', label: 'Tips Perawatan', icon: '🔧' },
    { value: 'MARKET_NEWS', label: 'Berita Pasar', icon: '📰' },
    { value: 'FEATURE_REVIEW', label: 'Review Fitur', icon: '⭐' },
    { value: 'FINANCING', label: 'Panduan Kredit', icon: '💰' },
    { value: 'LOCAL_INSIGHTS', label: 'Insight Lokal', icon: '📍' },
  ];

  const readingTime = (wordCount: number) => Math.ceil(wordCount / 200);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Blog & Panduan Mobil Bekas
          </h1>
          <p className="text-xl text-blue-100">
            Tips, panduan, dan insight untuk membantu Anda memilih mobil bekas terbaik
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-3 overflow-x-auto pb-4">
            <Link
              href="/blog"
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                !category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Semua Artikel
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.value}
                href={`/blog?category=${cat.value}`}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                  category === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat.icon} {cat.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">Belum ada artikel</h3>
            <p className="text-gray-600">
              Artikel untuk kategori ini sedang dalam proses pembuatan
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Featured Image */}
                  {post.featuredImage ? (
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-56 object-cover"
                    />
                  ) : (
                    <div className="w-full h-56 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-6xl">
                      📝
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-6">
                    {/* Category Badge */}
                    <div className="mb-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        {
                          categories.find((c) => c.value === post.category)
                            ?.label
                        }
                      </span>
                      {post.targetLocation && (
                        <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          📍 {post.targetLocation}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-blue-600">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <span>{readingTime(post.wordCount)} menit</span>
                        <span>•</span>
                        <span>{post.views} views</span>
                      </div>
                      <div className="text-blue-600 font-semibold hover:text-blue-800">
                        Baca →
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/blog?${new URLSearchParams({
                      ...(category && { category }),
                      page: (page - 1).toString(),
                    }).toString()}`}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-300"
                  >
                    ← Previous
                  </Link>
                )}

                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <Link
                        key={pageNum}
                        href={`/blog?${new URLSearchParams({
                          ...(category && { category }),
                          page: pageNum.toString(),
                        }).toString()}`}
                        className={`px-4 py-2 rounded-lg ${
                          pageNum === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    )
                  )}
                </div>

                {page < totalPages && (
                  <Link
                    href={`/blog?${new URLSearchParams({
                      ...(category && { category }),
                      page: (page + 1).toString(),
                    }).toString()}`}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-300"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* CTA Section */}
        <div className="mt-16 bg-blue-600 text-white rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Cari mobil bekas berkualitas?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Lihat koleksi lengkap mobil bekas pilihan kami
          </p>
          <Link
            href="/inventory"
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold"
          >
            Lihat Stok Mobil
          </Link>
        </div>
      </div>
    </div>
  );
}
