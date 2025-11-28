/**
 * Blog Detail Page
 * Route: /catalog/[slug]/blog/[postSlug]
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, User, Eye } from 'lucide-react';
import ShareButtons from '@/components/blog/ShareButtons';
import VehicleCard from '@/components/catalog/VehicleCard';

const prisma = new PrismaClient();

export default async function BlogPostPage({
    params
}: {
    params: { slug: string; postSlug: string }
}) {
    const { slug, postSlug } = params;

    const tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant) {
        return notFound();
    }

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
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <Button asChild variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
                            <Link href={`/catalog/${tenant.slug}/blog`} className="flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Kembali ke Blog
                            </Link>
                        </Button>

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
                        <div className="text-center bg-primary/5 rounded-lg p-8 border border-primary/10">
                            <h3 className="text-xl font-bold mb-4">Tertarik dengan kendaraan kami?</h3>
                            <div className="flex justify-center gap-4">
                                <Button asChild size="lg">
                                    <Link href={`/catalog/${tenant.slug}/vehicles`}>Lihat Koleksi Mobil</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href={`/catalog/${tenant.slug}/contact`}>Hubungi Kami</Link>
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
