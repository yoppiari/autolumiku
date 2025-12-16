/**
 * Blog Detail Page
 * Route: /catalog/[slug]/blog/[postSlug]
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, User, Eye } from 'lucide-react';
import ShareButtons from '@/components/blog/ShareButtons';
import VehicleCard from '@/components/catalog/VehicleCard';
import { prisma } from '@/lib/prisma';


export default async function BlogPostPage({
    params
}: {
    params: { slug: string; postSlug: string }
}) {
    const { slug, postSlug } = params;
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';

    const tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant) {
        return notFound();
    }

    // Generate URLs based on domain context
    const getUrl = (path: string) => {
        if (isCustomDomain) {
            return path; // Clean URL for custom domain
        }
        return `/catalog/${tenant.slug}${path}`; // Platform domain with catalog prefix
    };

    // Fetch blog post with author
    const post = await prisma.blogPost.findFirst({
        where: {
            tenantId: tenant.id,
            slug: postSlug,
            status: 'PUBLISHED',
        },
    });

    if (!post) {
        return notFound();
    }

    // Fetch relevant vehicles
    let relatedVehicles: any[] = [];

    // 1. Try explicit related vehicles
    if (post.relatedVehicles && post.relatedVehicles.length > 0) {
        relatedVehicles = await prisma.vehicle.findMany({
            where: {
                id: { in: post.relatedVehicles },
                status: 'AVAILABLE',
            },
            include: { photos: true },
        });
    }

    // 2. If no explicit, try matching keywords
    if (relatedVehicles.length === 0 && post.keywords.length > 0) {
        const searchConditions = post.keywords.flatMap(k => [
            { make: { contains: k, mode: 'insensitive' as const } },
            { model: { contains: k, mode: 'insensitive' as const } }
        ]);

        if (searchConditions.length > 0) {
            relatedVehicles = await prisma.vehicle.findMany({
                where: {
                    tenantId: tenant.id,
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
                tenantId: tenant.id,
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
                    tenantId: tenant.id,
                    status: 'AVAILABLE',
                },
                include: { photos: true },
                take: 3,
                orderBy: { createdAt: 'desc' },
            });
        }
    }

    return (
        <ThemeProvider tenantId={tenant.id}>
            <div className="min-h-screen bg-background flex flex-col">
                <CatalogHeader
                    branding={{
                        name: tenant.name,
                        logoUrl: tenant.logoUrl,
                        primaryColor: tenant.primaryColor,
                        secondaryColor: tenant.secondaryColor,
                        slug: tenant.slug,
                    }}
                    phoneNumber={tenant.phoneNumber || undefined}
                    whatsappNumber={tenant.whatsappNumber || undefined}
                    slug={tenant.slug}
                    isCustomDomain={isCustomDomain}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <Button asChild variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
                            <Link href={getUrl('/blog')} className="flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Kembali ke Blog
                            </Link>
                        </Button>

                        <article className="bg-card rounded-lg shadow-sm overflow-hidden border mb-8">
                            {post.featuredImage && (
                                <div className="w-full">
                                    <img
                                        src={post.featuredImage}
                                        alt={post.title}
                                        className="w-full h-auto"
                                    />
                                </div>
                            )}

                            <div className="p-6 md:p-10">
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                                    {post.publishedAt && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(post.publishedAt).toLocaleDateString('id-ID', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <User className="w-4 h-4" />
                                        <span>{post.authorName || 'Admin'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Eye className="w-4 h-4" />
                                        <span>{post.views} views</span>
                                    </div>
                                </div>

                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-8 leading-tight">
                                    {post.title}
                                </h1>

                                <div
                                    className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />

                                {/* Share Buttons */}
                                <div className="mt-8 pt-8 border-t">
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
                                <h2 className="text-2xl font-bold mb-6">Rekomendasi Mobil Untuk Anda</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {relatedVehicles.map((vehicle) => (
                                        <VehicleCard
                                            key={vehicle.id}
                                            vehicle={{
                                                ...vehicle,
                                                price: Number(vehicle.price)
                                            }}
                                            slug={tenant.slug}
                                            tenantId={tenant.id}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA */}
                        <div className="text-center bg-gradient-to-b from-primary/5 to-primary/10 rounded-xl p-8 md:p-12 border border-primary/10 shadow-sm">
                            <h3 className="text-2xl font-bold mb-3">Tertarik dengan kendaraan kami?</h3>
                            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                                Temukan mobil impian Anda dari koleksi terbaik kami atau konsultasikan kebutuhan Anda dengan tim ahli kami.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Button asChild size="lg" className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all">
                                    <Link href={getUrl('/vehicles')}>Lihat Koleksi Mobil</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto bg-background/50 hover:bg-background transition-all">
                                    <Link href={getUrl('/contact')}>Hubungi Kami</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>

                <GlobalFooter
                    tenant={{
                        name: tenant.name,
                        phoneNumber: tenant.phoneNumber,
                        phoneNumberSecondary: tenant.phoneNumberSecondary,
                        whatsappNumber: tenant.whatsappNumber,
                        email: tenant.email,
                        address: tenant.address,
                        city: tenant.city,
                        province: tenant.province,
                        primaryColor: tenant.primaryColor,
                    }}
                />
            </div>
        </ThemeProvider>
    );
}
