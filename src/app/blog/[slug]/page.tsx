import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

async function getBlogPost(slug: string) {
  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
    },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  // Increment views
  await prisma.blogPost.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });

  return post;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPost(params.slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found',
    };
  }

  return {
    title: post.title,
    description: post.metaDescription,
    keywords: [...post.keywords, ...post.localKeywords].join(', '),
    authors: [{ name: post.authorName }],
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.authorName],
      images: post.featuredImage ? [post.featuredImage] : [],
      locale: 'id_ID',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription,
      images: post.featuredImage ? [post.featuredImage] : [],
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    other: {
      'article:published_time': post.publishedAt?.toISOString() || '',
      'article:author': post.authorName,
      'article:tag': post.keywords.join(','),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const readingTime = Math.ceil(post.wordCount / 200); // Assume 200 words per minute

  // JSON-LD Schema.org markup for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription,
    image: post.featuredImage || '',
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: post.tenant.name,
      logo: {
        '@type': 'ImageObject',
        url: '', // TODO: Add tenant logo
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://yourdomain.com/blog/${post.slug}`,
    },
    keywords: [...post.keywords, ...post.localKeywords].join(', '),
    articleBody: post.content,
    wordCount: post.wordCount,
  };

  // Related posts (same category, exclude current)
  const relatedPosts = await prisma.blogPost.findMany({
    where: {
      tenantId: post.tenantId,
      category: post.category,
      status: 'PUBLISHED',
      id: { not: post.id },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
    },
    take: 3,
    orderBy: { views: 'desc' },
  });

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        {post.featuredImage && (
          <div className="w-full h-96 bg-gray-900">
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="w-full h-full object-cover opacity-90"
            />
          </div>
        )}

        {/* Article Header */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8 -mt-20 relative z-10">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-600 mb-4">
              <a href="/" className="hover:text-blue-600">
                Home
              </a>
              {' > '}
              <a href="/blog" className="hover:text-blue-600">
                Blog
              </a>
              {' > '}
              <span className="text-gray-900">{post.title}</span>
            </nav>

            {/* Title */}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6 pb-6 border-b">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{post.authorName}</span>
              </div>
              <span>•</span>
              <div>
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </div>
              <span>•</span>
              <div>{readingTime} menit baca</div>
              <span>•</span>
              <div>{post.views.toLocaleString()} views</div>
            </div>

            {/* Category & Keywords */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                {post.category}
              </span>
              {post.targetLocation && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  📍 {post.targetLocation}
                </span>
              )}
            </div>

            {/* Excerpt */}
            {post.excerpt && (
              <div className="text-xl text-gray-700 font-medium mb-8 pb-8 border-b">
                {post.excerpt}
              </div>
            )}

            {/* Article Content */}
            <div
              className="prose prose-lg max-w-none mb-8"
              dangerouslySetInnerHTML={{ __html: post.content }}
              style={{
                lineHeight: '1.8',
              }}
            />

            {/* Tags/Keywords */}
            <div className="pt-8 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Tags:
              </h3>
              <div className="flex flex-wrap gap-2">
                {post.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 cursor-pointer"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Share Buttons */}
            <div className="pt-8 border-t mt-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Bagikan artikel ini:
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const url = window.location.href;
                    const text = post.title;
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
                      '_blank'
                    );
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  📘 Facebook
                </button>
                <button
                  onClick={() => {
                    const url = window.location.href;
                    const text = post.title;
                    window.open(
                      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
                      '_blank'
                    );
                  }}
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm"
                >
                  🐦 Twitter
                </button>
                <button
                  onClick={() => {
                    const url = window.location.href;
                    const text = post.title;
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
                      '_blank'
                    );
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  💬 WhatsApp
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link berhasil disalin!');
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  🔗 Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Artikel Terkait
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <a
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {related.featuredImage ? (
                    <img
                      src={related.featuredImage}
                      alt={related.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-5xl">
                      📝
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {related.excerpt}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-blue-600 text-white py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Tertarik dengan mobil bekas berkualitas?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Kunjungi showroom {post.tenant.name} di {post.targetLocation} untuk
              pilihan terbaik!
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="/inventory"
                className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold"
              >
                Lihat Stok Mobil
              </a>
              <a
                href="/contact"
                className="px-8 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-semibold border-2 border-white"
              >
                Hubungi Kami
              </a>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
