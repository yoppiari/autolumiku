/**
 * Blog Listing Page
 * Route: /catalog/[slug]/blog
 */

import React from 'react';
import Link from 'next/link';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
import { prisma } from '@/lib/prisma';
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';


export default async function BlogPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    const tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
                </div>
            </div>
        );
    }

    const blogPosts = await prisma.blogPost.findMany({
        where: {
            tenantId: tenant.id,
            status: 'PUBLISHED',
        },
        orderBy: {
            publishedAt: 'desc',
        },
        select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            views: true,
            authorName: true,
        },
    });

    const getExcerpt = (content: string | null, maxLength: number = 150): string => {
        if (!content) return '';
        const text = content.replace(/<[^>]*>/g, '');
        const firstPara = text.split('\n\n')[0] || text.split('\n')[0] || text;
        if (firstPara.length > maxLength) {
            return firstPara.substring(0, maxLength) + '...';
        }
        return firstPara;
    };

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
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            Blog & Artikel
                        </h1>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Berita terbaru, tips otomotif, dan ulasan kendaraan dari {tenant.name}
                        </p>
                    </div>

                    {blogPosts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {blogPosts.map((post) => (
                                <div key={post.id} className="group cursor-pointer flex flex-col h-full">
                                    <Link href={`/catalog/${tenant.slug}/blog/${post.slug}`} className="block">
                                        <div className="aspect-video relative rounded-2xl overflow-hidden mb-5 bg-muted">
                                            {post.featuredImage ? (
                                                <img
                                                    src={post.featuredImage}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
                                                    No Image
                                                </div>
                                            )}
                                            {/* Date Badge */}
                                            {post.publishedAt && (
                                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                                                    {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="flex-1 flex flex-col">
                                        <div className="text-xs text-primary font-bold mb-2 uppercase tracking-wide">
                                            {post.authorName || 'Redaksi'}
                                        </div>
                                        <h3 className="text-2xl font-bold text-foreground mb-3 leading-tight group-hover:text-primary transition-colors">
                                            <Link href={`/catalog/${tenant.slug}/blog/${post.slug}`}>
                                                {post.title}
                                            </Link>
                                        </h3>
                                        <p className="text-muted-foreground line-clamp-3 mb-4 flex-1">
                                            {getExcerpt(post.excerpt)}
                                        </p>
                                        <Link
                                            href={`/catalog/${tenant.slug}/blog/${post.slug}`}
                                            className="inline-flex items-center text-primary font-semibold hover:underline mt-auto"
                                        >
                                            Baca Selengkapnya
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-muted/30 rounded-lg">
                            <p className="text-muted-foreground text-lg">Belum ada artikel yang diterbitkan.</p>
                        </div>
                    )}
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
