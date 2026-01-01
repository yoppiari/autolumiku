import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantFromHeaders } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import VehicleCard from '@/components/catalog/VehicleCard';
import { Calendar, User, Eye, ArrowLeft } from 'lucide-react';
import ShareButtons from './ShareButtons';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

async function getBlogPost(slug: string, tenantId: string | null, domain: string | null) {
  // If accessing from platform domain (auto.lumiku.com), show blogs from all tenants
  // Otherwise, filter by specific tenant
  const isPlatformDomain = domain === 'auto.lumiku.com' || !tenantId;

  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      // Only filter by tenantId if NOT on platform domain
      ...(isPlatformDomain ? {} : { tenantId }),
      status: 'PUBLISHED',
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          phoneNumber: true,
          phoneNumberSecondary: true,
          whatsappNumber: true,
          email: true,
          address: true,
          city: true,
          province: true,
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

async function getRelatedVehicles(post: any, tenantId: string) {
  let relatedVehicles: any[] = [];

  // 1. Try explicit related vehicles
  if (post.relatedVehicles && post.relatedVehicles.length > 0) {
    relatedVehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: post.relatedVehicles },
        status: 'AVAILABLE',
      },
      include: { photos: true },
      take: 3,
    });
  }

  // 2. If no explicit, try matching keywords
  if (relatedVehicles.length === 0 && post.keywords.length > 0) {
    const searchConditions = post.keywords.flatMap((k: string) => [
      { make: { contains: k, mode: 'insensitive' as const } },
      { model: { contains: k, mode: 'insensitive' as const } }
    ]);

    if (searchConditions.length > 0) {
      relatedVehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'AVAILABLE',
          OR: searchConditions
        },
        include: { photos: true },
        take: 3,
      });
    }
  }

  // 3. Fallback to Featured or Latest
  if (relatedVehicles.length === 0) {
    relatedVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'AVAILABLE',
        isFeatured: true,
      },
      include: { photos: true },
      take: 3,
    });

    // If still 0, just take latest
    if (relatedVehicles.length === 0) {
      relatedVehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: 'AVAILABLE',
        },
        include: { photos: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  return relatedVehicles;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();

  const post = await getBlogPost(params.slug, tenant.id, tenant.domain);

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
  const tenant = await getTenantFromHeaders();

  const post = await getBlogPost(params.slug, tenant.id, tenant.domain);

  if (!post) {
    notFound();
  }

  const readingTime = Math.ceil((post.wordCount ?? 0) / 200);

  // Get related vehicles
  const relatedVehicles = await getRelatedVehicles(post, post.tenant.id);

  return (
    <ThemeProvider tenantId={post.tenant.id}>
      <div className="min-h-screen bg-background flex flex-col">
        <CatalogHeader
          branding={{
            name: post.tenant.name,
            logoUrl: post.tenant.logoUrl,
            primaryColor: post.tenant.primaryColor,
            secondaryColor: post.tenant.secondaryColor,
            slug: post.tenant.slug,
          }}
          phoneNumber={post.tenant.phoneNumber || undefined}
          whatsappNumber={post.tenant.whatsappNumber || undefined}
          slug={post.tenant.slug}
        />

        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span>{'>'}</span>
              <Link href={`/catalog/${post.tenant.slug}/blog`} className="hover:text-primary transition-colors">
                Blog
              </Link>
              <span>{'>'}</span>
              <span className="text-foreground">{post.title}</span>
            </nav>

            <article className="bg-card rounded-lg shadow-sm overflow-hidden border mb-8">
              {post.featuredImage && (
                <div className="aspect-video w-full relative">
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6 md:p-10">
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  {post.publishedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{post.authorName || 'Admin'}</span>
                  </div>
                  <span>•</span>
                  <span>{readingTime} menit baca</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{post.views} views</span>
                  </div>
                </div>

                {/* Category & Location */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                    {post.category}
                  </span>
                  {post.targetLocation && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-full text-sm">
                      📍 {post.targetLocation}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>

                {/* Excerpt */}
                {post.excerpt && (
                  <div className="text-xl text-muted-foreground font-medium mb-8 pb-8 border-b">
                    {post.excerpt}
                  </div>
                )}

                {/* Content */}
                <div
                  className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                  style={{ lineHeight: '1.8' }}
                />

                {/* Tags */}
                {post.keywords.length > 0 && (
                  <div className="pt-8 border-t mt-8">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      Tags:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {post.keywords.map((keyword: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm hover:bg-secondary/80 cursor-pointer transition-colors"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share Buttons */}
                <div className="pt-8 border-t mt-8">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Bagikan artikel ini:
                  </h3>
                  <ShareButtons title={post.title} />
                </div>
              </div>
            </article>

            {/* Related Vehicles */}
            {relatedVehicles.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Rekomendasi Mobil Untuk Anda
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={{
                        ...vehicle,
                        price: Number(vehicle.price)
                      }}
                      slug={post.tenant.slug}
                      tenantId={post.tenant.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="text-center bg-gradient-to-b from-primary/5 to-primary/10 rounded-xl p-8 md:p-12 border border-primary/10 shadow-sm">
              <h3 className="text-2xl font-bold mb-3">
                Tertarik dengan kendaraan kami?
              </h3>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Temukan mobil impian Anda dari koleksi terbaik kami atau konsultasikan kebutuhan Anda dengan tim ahli kami.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href={`/catalog/${post.tenant.slug}/vehicles`}
                  className="inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold shadow-sm hover:shadow-md transition-all"
                >
                  Lihat Koleksi Mobil
                </Link>
                <Link
                  href={`/catalog/${post.tenant.slug}/contact`}
                  className="inline-flex items-center justify-center px-8 py-3 bg-background border-2 border-primary text-primary rounded-lg hover:bg-primary/5 font-semibold transition-all"
                >
                  Hubungi Kami
                </Link>
              </div>
            </div>
          </div>
        </main>

        <GlobalFooter
          tenant={{
            name: post.tenant.name,
            phoneNumber: post.tenant.phoneNumber,
            phoneNumberSecondary: post.tenant.phoneNumberSecondary,
            whatsappNumber: post.tenant.whatsappNumber,
            email: post.tenant.email,
            address: post.tenant.address,
            city: post.tenant.city,
            province: post.tenant.province,
            primaryColor: post.tenant.primaryColor,
          }}
        />
      </div>
    </ThemeProvider>
  );
}
